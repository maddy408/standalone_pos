<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Helpers\PermissionDeniedException;
use App\Helpers\Response;

class PermissionMiddleware
{
    /** @param array<string, mixed> $claims */
    public static function has(array $claims, string $code): bool
    {
        return in_array($code, (array) ($claims['permissions'] ?? []), true);
    }

    /**
     * For direct REST endpoints: exits with a 403 response immediately.
     * Never call this from code also reachable through the sync batch
     * dispatcher — use requireOrThrow() there instead, see below.
     *
     * @param array<string, mixed> $claims
     */
    public static function require(array $claims, string $code): void
    {
        if (!self::has($claims, $code)) {
            Response::error("Forbidden — missing permission: {$code}", 403);
        }
    }

    /**
     * For code paths shared with SyncController's batch dispatcher: throws
     * instead of exiting, so a per-operation catch block can turn this into
     * a clean "failed" result for just that one queued item.
     *
     * @param array<string, mixed> $claims
     */
    public static function requireOrThrow(array $claims, string $code): void
    {
        if (!self::has($claims, $code)) {
            throw new PermissionDeniedException("Forbidden — missing permission: {$code}");
        }
    }
}
