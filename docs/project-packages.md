# StudyTube project packages

StudyTube accepts one project file per render.

## Text-only projects

Use a `.studytube.json` file when the project has no entries in `assets`.

The JSON is the complete project. Do not declare image or document assets in a standalone JSON project.

## Projects with assets

Use a `.studytube.zip` file whenever the project contains one or more image or document assets.

The archive must have this shape:

```text
my-video.studytube.zip
├── project.studytube.json
└── assets
    ├── example.png
    └── reader.pdf
```

`project.studytube.json` must be at the ZIP root. Every `assets.*.path` value in the project JSON must point to a file at that exact relative path inside the archive.

Example:

```json
{
  "assets": {
    "example": {
      "type": "image",
      "path": "assets/example.png",
      "alt": "Example image"
    }
  }
}
```

Remote URLs are not asset paths. If an image is found online or generated with ChatGPT, download/create the actual file and include it in the ZIP.

## Safety and limits

Project paths must be relative and may not contain traversal (`..`), absolute paths, Windows drive paths or backslashes. ZIP64 and encrypted ZIP archives are not supported.

StudyTube currently limits project JSON to 5 MB, a compressed ZIP to 200 MB, an individual packaged file to 100 MB, and the total declared uncompressed ZIP size to 300 MB.
