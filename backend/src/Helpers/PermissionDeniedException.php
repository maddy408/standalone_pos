<?php

declare(strict_types=1);

namespace App\Helpers;

/**
 * Thrown (instead of exiting) by permission checks inside code shared with
 * the sync batch dispatcher, so one forbidden queued operation fails with a
 * clean per-item result instead of killing the whole /sync/push response.
 */
class PermissionDeniedException extends \RuntimeException
{
}
