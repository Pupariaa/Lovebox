<?php

declare(strict_types=1);

namespace Bac\Repositories;

use PDO;

final class FirmwareReleaseRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function create(array $data): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO firmware_releases
             (version, channel, firmware_file, firmware_sha256, firmware_size,
              assets_file, assets_sha256, assets_size, min_version, notes, published)
             VALUES
             (:version, :channel, :firmware_file, :firmware_sha256, :firmware_size,
              :assets_file, :assets_sha256, :assets_size, :min_version, :notes, 0)'
        );
        $stmt->execute([
            'version' => $data['version'],
            'channel' => $data['channel'] ?? 'stable',
            'firmware_file' => $data['firmware_file'],
            'firmware_sha256' => $data['firmware_sha256'],
            'firmware_size' => $data['firmware_size'],
            'assets_file' => $data['assets_file'] ?? null,
            'assets_sha256' => $data['assets_sha256'] ?? null,
            'assets_size' => $data['assets_size'] ?? null,
            'min_version' => $data['min_version'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM firmware_releases WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByVersion(string $version): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM firmware_releases WHERE version = :v LIMIT 1');
        $stmt->execute(['v' => $version]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function listAll(): array
    {
        $stmt = $this->pdo->query(
            'SELECT * FROM firmware_releases ORDER BY created_at DESC'
        );
        return $stmt->fetchAll();
    }

    public function getActivePublished(): ?array
    {
        $stmt = $this->pdo->query(
            'SELECT * FROM firmware_releases
             WHERE published = 1
             ORDER BY published_at DESC, id DESC
             LIMIT 1'
        );
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function publish(int $id): bool
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                'UPDATE firmware_releases SET published = 0 WHERE published = 1'
            );
            $stmt->execute();
            $upd = $this->pdo->prepare(
                'UPDATE firmware_releases SET published = 1, published_at = NOW() WHERE id = :id'
            );
            $upd->execute(['id' => $id]);
            $ok = $upd->rowCount() > 0;
            $this->pdo->commit();
            return $ok;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
