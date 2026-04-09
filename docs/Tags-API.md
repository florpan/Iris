# Tags API

The image tagging system allows users to add, manage, and organize custom tags on images. Tags are stored separately from EXIF metadata and can be applied to any image.

## Tag Validation Rules

- **Max length:** 50 characters
- **Normalization:** Names are trimmed of whitespace and lowercased automatically
- **Duplicates:** Case-insensitive duplicates are rejected (e.g., "Sunset" and "sunset" are the same tag)
- **Invalid characters:** `< > { } [ ] \ ^ \` |` are not allowed
- **Empty tags:** Empty strings and whitespace-only names are rejected

---

## Tag Endpoints

### GET /api/tags

List all tags, with optional filtering.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | — | Partial name filter (case-insensitive) |
| `sort` | `name` \| `usage` | `name` | Sort order. `usage` sorts by usage_count descending, then name |
| `limit` | number | 50 | Max results (capped at 200) |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "sunset",
      "color": "#f59e0b",
      "usageCount": 42,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### GET /api/tags/autocomplete

Returns tag suggestions for autocomplete UI. Sorted by usage (most popular first), then name.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | — | Partial name filter |
| `limit` | number | 10 | Max results (capped at 50) |

**Response:** Same as `GET /api/tags`.

---

### POST /api/tags

Create a new tag.

**Body:**
```json
{
  "name": "landscape",
  "color": "#3b82f6"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Tag name (validated and normalized) |
| `color` | string | no | Optional hex color for the tag |

**Response:** `201 Created`
```json
{
  "data": {
    "id": 5,
    "name": "landscape",
    "color": "#3b82f6",
    "usageCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `400` — Invalid/empty name, name too long, invalid characters
- `409` — Tag with that name already exists

---

### GET /api/tags/:id

Get a single tag by ID.

**Response:**
```json
{
  "data": { "id": 5, "name": "landscape", "color": null, "usageCount": 12, "createdAt": "..." }
}
```

**Errors:** `400` (invalid ID), `404` (not found)

---

### PUT /api/tags/:id

Update a tag's name and/or color.

**Body:**
```json
{
  "name": "new-name",
  "color": "#ef4444"
}
```

Both fields are optional. Only provided fields are updated.

**Errors:**
- `400` — Invalid ID, invalid name
- `404` — Tag not found
- `409` — New name conflicts with an existing tag

---

### DELETE /api/tags/:id

Delete a tag and remove it from all images (cascade). Usage counts are not updated since the tag itself is gone.

**Response:**
```json
{ "success": true }
```

**Errors:** `400` (invalid ID), `404` (not found)

---

## Image Tag Endpoints

### GET /api/images/:imageId/tags

List all tags applied to an image.

**Response:**
```json
{
  "data": [
    { "id": 1, "name": "landscape", "color": null, "usageCount": 12, "createdAt": "..." }
  ]
}
```

---

### POST /api/images/:imageId/tags

Add one or more tags to an image. Tags can be specified by ID or by name (new tags are created automatically).

**Body:**
```json
{
  "tagIds": [1, 2, 3],
  "names": ["new-tag", "another-tag"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tagIds` | number[] | no* | Existing tag IDs to add |
| `names` | string[] | no* | Tag names to add (created if they don't exist) |

*At least one of `tagIds` or `names` must be provided.

**Response:** Returns the full updated list of tags on the image.

**Notes:**
- Adding a tag that's already on the image is a no-op (idempotent)
- `usage_count` is updated atomically within a transaction

---

### DELETE /api/images/:imageId/tags/:tagId

Remove a specific tag from an image.

**Response:**
```json
{ "success": true }
```

**Notes:** `usage_count` on the tag is decremented atomically. The tag itself is NOT deleted.

---

## Bulk Operations

### POST /api/tags/bulk/add

Add one or more tags to multiple images in a single request. Uses a database transaction for atomicity.

**Body:**
```json
{
  "imageIds": [10, 11, 12],
  "tagIds": [1, 2]
}
```

**Response:**
```json
{
  "success": true,
  "applied": {
    "imageIds": [10, 11, 12],
    "tagIds": [1, 2]
  }
}
```

**Errors:**
- `400` — Empty arrays or tag IDs not found

---

### POST /api/tags/bulk/remove

Remove one or more tags from multiple images in a single request.

**Body:**
```json
{
  "imageIds": [10, 11, 12],
  "tagIds": [1, 2]
}
```

**Response:**
```json
{
  "success": true,
  "removed": {
    "imageIds": [10, 11, 12],
    "tagIds": [1, 2]
  }
}
```

---

## Usage Count Tracking

The `usage_count` field on each tag reflects how many images currently have that tag. It is:

- **Incremented** when a tag is added to an image (via `POST /api/images/:id/tags` or bulk add)
- **Decremented** when a tag is removed from an image (via `DELETE /api/images/:id/tags/:tagId` or bulk remove)
- **Recomputed from source** using a subquery (`SELECT count(*) FROM image_tags WHERE tag_id = ?`) within the same transaction to avoid race conditions

Deleting a tag entirely (`DELETE /api/tags/:id`) removes the tag and all associations via cascade — no usage_count update is needed.
