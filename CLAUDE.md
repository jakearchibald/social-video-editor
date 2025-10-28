# Goals

This project is a web app that allows the user to edit and output video by overlaying things like images and code examples.

# Features

- Scrubbing back and forth through the video timeline
- Loading/saving the project as JSON to disk via the filesystem API
- A scheme for the JSON
- Rendering code examples, with syntax highlighting, and animated typing/editing
- Rendering subtitles

# Technology

The web app is built with Preact, and aims to deploy on Cloudflare Workers.

# Coding styles

- Avoid prefixing global APIs with `window.` unless necessary for disambiguation.
- In JSX, use `class` rather than `className`.
- Prefer to early-exit/throw functions, rather than nesting code.
- Use '…' rather than '...' for ellipses in strings.
