# Facebook Media Uploader

Automated tool to upload media files to Facebook personal albums using agent-browser.

[GitHub Repository](https://github.com/wongchichong/fb-uploader)

## Prerequisites

- Node.js (v14 or higher)
- [agent-browser](https://github.com/wongchichong/agent-browser) CLI tool installed and configured
- [tsx](https://www.npmjs.com/package/tsx) (TypeScript runner)
- Create a `.env` file with your Facebook personal albums URL (see below)

**Important**: Before running the script, you need to log into Facebook using agent-browser:

1. Run: `agent-browser --headed open "https://www.facebook.com"`
2. Log in manually in the browser
3. Navigate to your Facebook profile and go to Photos section
4. Close the browser window
5. The script will then prompt you to continue after confirming login

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install dependencies (tsx and dotenv are included):
   ```bash
   npm install
   ```

3. Create a .env file in the project root with your Facebook personal albums URL:
   ```env
   FACEBOOK_ALBUMS_URL=https://www.facebook.com/me/photos_albums
   ```

## Usage

### Command Line

```bash
# Basic usage
npx tsx facebook-uploader.ts "path/to/your/media/folder"

# With custom photo batch size (default is 50)
npx tsx facebook-uploader.ts "path/to/your/media/folder" --photo-batch-size 30

# With custom video batch size (default is 10)
npx tsx facebook-uploader.ts "path/to/your/media/folder" --video-batch-size 5

# With custom base URL (default is from .env file)
npx tsx facebook-uploader.ts "path/to/your/media/folder" --base-url "https://www.facebook.com/me/photos_albums"

# With custom session name (default is 'default')
npx tsx facebook-uploader.ts "path/to/your/media/folder" --session "my-session"

# With both custom photo and video batch sizes
npx tsx facebook-uploader.ts "path/to/your/media/folder" --photo-batch-size 25 --video-batch-size 8

# With photo batch size, video batch size and session name
npx tsx facebook-uploader.ts "path/to/your/media/folder" --photo-batch-size 25 --video-batch-size 8 --session "my-session"

# With all options
npx tsx fb-uploader.ts "path/to/your/media/folder" --photo-batch-size 25 --video-batch-size 8 --session "my-session" --base-url "https://www.facebook.com/me/photos_albums" --profile-path "C:/custom/profile"

# Show help
npx tsx facebook-uploader.ts --help
```

### Programmatic Usage

```typescript
import { FacebookMediaUploader, UploadOptions, GetRefOptions } from './fb-uploader';

const uploader = new FacebookMediaUploader({
  folderPath: '/path/to/media/folder',
  photoBatchSize: 50,
  videoBatchSize: 10,
  sessionName: 'default'
});

await uploader.uploadMedia('Album Name');
```

## Features

- Automatically creates batches of media files
- Handles both photos and videos with separate batch sizes
- Supports common image formats: JPG, JPEG, PNG, GIF
- Supports common video formats: MP4, MOV, AVI
- Photo batch size defaults to 50, video batch size defaults to 10
- Waits for Facebook UI to update between batches
- Uses forward-slash paths compatible with agent-browser

## Notes

- The script will prompt you to ensure you're logged into Facebook in the agent-browser session
- The album name will be derived from the folder name
- Photos are uploaded in batches of 50 (configurable via --photo-batch-size)
- Videos are uploaded in batches of 10 (configurable via --video-batch-size)
- The script expects the album to already exist in your Facebook personal/group albums list