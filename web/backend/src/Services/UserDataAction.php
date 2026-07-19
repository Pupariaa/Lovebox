<?php

declare(strict_types=1);

namespace Bac\Services;

final class UserDataAction
{
    public const ACCOUNT_DELETE = 'account_delete';
    public const DATA_DELETE = 'data_delete';
    public const DATA_EXPORT = 'data_export';

    /** @return list<string> */
    public static function all(): array
    {
        return [self::ACCOUNT_DELETE, self::DATA_DELETE, self::DATA_EXPORT];
    }

    public static function isValid(string $action): bool
    {
        return in_array($action, self::all(), true);
    }
}
