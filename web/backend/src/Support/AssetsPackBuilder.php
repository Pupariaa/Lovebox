<?php

declare(strict_types=1);

namespace Bac\Support;

final class AssetsPackBuilder
{
    private const MAGIC = 'BACA';
    private const MANIFEST_MAGIC = 'BACX';

    public static function buildFromAssetsDirectory(string $assetsDir, string $outputPath): array
    {
        $assetsDir = rtrim(str_replace('\\', '/', $assetsDir), '/');
        if (!is_dir($assetsDir)) {
            throw new \InvalidArgumentException('assets directory missing');
        }

        $files = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($assetsDir, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $file) {
            if (!$file->isFile()) {
                continue;
            }
            $full = str_replace('\\', '/', $file->getPathname());
            $rel = substr($full, strlen($assetsDir) + 1);
            $path = '/assets/' . $rel;
            // Skip control dotfiles (.manifest, .ok) that may be present when packing
            // from an on-device data directory; they are managed separately by the device.
            if (str_starts_with(basename($path), '.')) {
                continue;
            }
            if (!self::isSafeAssetPath($path)) {
                throw new \InvalidArgumentException('unsafe asset path: ' . $path);
            }
            $files[] = ['path' => $path, 'full' => $file->getPathname()];
        }

        usort($files, static fn ($a, $b) => strcmp($a['path'], $b['path']));

        $fp = fopen($outputPath, 'wb');
        if (!$fp) {
            throw new \RuntimeException('cannot write assets pack');
        }
        // 12-byte header: magic(4) + format version(4) + file count(4).
        fwrite($fp, self::MAGIC);
        fwrite($fp, pack('V', 1));
        fwrite($fp, pack('V', count($files)));
        // Track each record's byte offset (start of its pathLen field) and data sha so a
        // sidecar manifest lets the device diff-sync: records are written back-to-back, so
        // a run of consecutive changed files is one contiguous byte range in the pack.
        $offset = 12;
        $manifest = [];
        foreach ($files as $entry) {
            $path = $entry['path'];
            $data = file_get_contents($entry['full']);
            if ($data === false) {
                fclose($fp);
                throw new \RuntimeException('cannot read ' . $entry['full']);
            }
            fwrite($fp, pack('v', strlen($path)));
            fwrite($fp, $path);
            fwrite($fp, pack('V', strlen($data)));
            fwrite($fp, $data);
            $manifest[] = [
                'path' => $path,
                'size' => strlen($data),
                'offset' => $offset,
                'sha' => hash('sha256', $data, true),
            ];
            $offset += 2 + strlen($path) + 4 + strlen($data);
        }
        fclose($fp);

        $size = filesize($outputPath);
        $sha = hash_file('sha256', $outputPath);
        if ($size === false || $sha === false) {
            throw new \RuntimeException('assets pack hash failed');
        }

        $manifestPath = self::manifestPathFor($outputPath);
        self::writeManifest($manifestPath, $manifest);

        return [
            'file_count' => count($files),
            'size' => $size,
            'sha256' => $sha,
            'manifest_file' => basename($manifestPath),
        ];
    }

    public static function manifestPathFor(string $packPath): string
    {
        if (str_ends_with($packPath, '.bacassets')) {
            return substr($packPath, 0, -strlen('.bacassets')) . '.manifest';
        }
        return $packPath . '.manifest';
    }

    private static function writeManifest(string $manifestPath, array $entries): void
    {
        $fp = fopen($manifestPath, 'wb');
        if (!$fp) {
            throw new \RuntimeException('cannot write assets manifest');
        }
        fwrite($fp, self::MANIFEST_MAGIC);
        fwrite($fp, pack('V', 1));
        fwrite($fp, pack('V', count($entries)));
        foreach ($entries as $e) {
            fwrite($fp, pack('v', strlen($e['path'])));
            fwrite($fp, $e['path']);
            fwrite($fp, pack('V', $e['size']));
            fwrite($fp, pack('V', $e['offset']));
            fwrite($fp, $e['sha']);
        }
        fclose($fp);
    }

    public static function buildFromZip(string $zipPath, string $outputPath): array
    {
        if (!class_exists(\ZipArchive::class)) {
            throw new \RuntimeException('ZipArchive not available');
        }
        $zip = new \ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new \InvalidArgumentException('invalid zip');
        }

        $tmpdir = sys_get_temp_dir() . '/bac_assets_' . bin2hex(random_bytes(8));
        if (!mkdir($tmpdir, 0700, true) && !is_dir($tmpdir)) {
            $zip->close();
            throw new \RuntimeException('temp mkdir failed');
        }

        try {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = str_replace('\\', '/', (string) $zip->getNameIndex($i));
                if ($name === '' || str_ends_with($name, '/')) {
                    continue;
                }
                if (preg_match('#(^|/)user\\.txt$#i', $name)) {
                    throw new \InvalidArgumentException('zip must not contain user.txt');
                }
                if (!str_starts_with($name, 'assets/')) {
                    throw new \InvalidArgumentException('zip must contain only assets/ files');
                }
            }

            if (!$zip->extractTo($tmpdir)) {
                throw new \RuntimeException('zip extract failed');
            }
            $zip->close();
            return self::buildFromAssetsDirectory($tmpdir . '/assets', $outputPath);
        } finally {
            self::removeTree($tmpdir);
        }
    }

    private static function isSafeAssetPath(string $path): bool
    {
        if (!str_starts_with($path, '/assets/')) {
            return false;
        }
        if (str_contains($path, '..')) {
            return false;
        }
        if (strcasecmp(basename($path), 'user.txt') === 0) {
            return false;
        }
        return true;
    }

    private static function removeTree(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $items = scandir($dir);
        if ($items === false) {
            return;
        }
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                self::removeTree($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
