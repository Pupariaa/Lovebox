<?php

declare(strict_types=1);

namespace Bac\Services;

final class BacmValidator
{
    private const MAGIC = "BACM";
    private const MAX_SIZE = 2097152;
    private const EXPECTED_W = 280;
    private const EXPECTED_H = 240;

    public function validate(string $data): ?string
    {
        $len = strlen($data);
        if ($len < 12 || $len > self::MAX_SIZE) {
            return 'invalid size';
        }
        if (substr($data, 0, 4) !== self::MAGIC) {
            return 'invalid magic';
        }
        $version = unpack('v', substr($data, 4, 2))[1];
        if ($version !== 1) {
            return 'unsupported version';
        }
        $w = unpack('v', substr($data, 6, 2))[1];
        $h = unpack('v', substr($data, 8, 2))[1];
        if ($w !== self::EXPECTED_W || $h !== self::EXPECTED_H) {
            return 'invalid dimensions';
        }
        $layerCount = ord($data[10]);
        if ($layerCount > 8) {
            return 'too many layers';
        }
        $bgSize = $w * $h * 2;
        $minSize = 12 + $bgSize;
        if ($len < $minSize) {
            return 'truncated background';
        }
        return null;
    }

    public function extractPreviewBase64(string $data): ?string
    {
        $w = self::EXPECTED_W;
        $h = self::EXPECTED_H;
        $bgOffset = 12;
        $bgLen = $w * $h * 2;
        if (strlen($data) < $bgOffset + $bgLen) {
            return null;
        }
        $bg = substr($data, $bgOffset, $bgLen);
        $img = imagecreatetruecolor($w, $h);
        if ($img === false) {
            return null;
        }
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $i = ($y * $w + $x) * 2;
                $px = unpack('v', substr($bg, $i, 2))[1];
                $r = (($px >> 11) & 0x1f) << 3;
                $g = (($px >> 5) & 0x3f) << 2;
                $b = ($px & 0x1f) << 3;
                imagesetpixel($img, $x, $y, imagecolorallocate($img, $r, $g, $b));
            }
        }
        ob_start();
        imagepng($img);
        $png = ob_get_clean();
        imagedestroy($img);
        if ($png === false) {
            return null;
        }
        return base64_encode($png);
    }
}
