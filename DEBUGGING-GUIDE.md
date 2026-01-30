# Facebook Uploader Debugging Guide

## Debugging Setup with VS Code Debugger MCP

This guide explains how to debug `fb-uploader.ts` using the VS Code debugger MCP and agent-browser CLI.

## Prerequisites

1. VS Code with Debugger for Chrome extension
2. Node.js with tsx installed
3. agent-browser CLI tool installed
4. The VS Code debugger MCP configured in your `mcp.json`

## Debug Configurations

The `.vscode/launch.json` contains several debug configurations:

### 1. "Debug Facebook Uploader - Main Script"
- **Purpose**: Debug the main fb-uploader.ts script
- **Features**: 
  - Stops at entry point (`--inspect-brk`)
  - Pre-launch cleanup task
  - Strategic `debugger;` statements for browser state inspection

### 2. "Debug with Agent-Browser Snapshot Inspection"
- **Purpose**: Run without stopping at entry, but with cleanup
- **Features**: Pre-launch cleanup, continuous execution

### 3. "Debug with Pre-cleanup and Snapshot"
- **Purpose**: Full cleanup and snapshot inspection
- **Features**: Comprehensive pre-launch cleanup

## Strategic Debugging Points

The code includes `debugger;` statements at key locations:

1. **Before browser opens** (line ~475): Inspect state before `agent-browser --headed` command
2. **After browser opens** (line ~487): Inspect initial browser state with snapshot
3. **Before upload batch** (line ~125): Inspect state before file uploads
4. **In manageFailUploads** (line ~106): Inspect browser state when checking for failed uploads

## Debugging Workflow

### 1. Start Debugging
1. Open VS Code in the project folder
2. Go to Run and Debug panel (Ctrl+Shift+D)
3. Select "Debug Facebook Uploader - Main Script"
4. Press F5 to start debugging

### 2. Using Debug Console
When stopped at a breakpoint, you can use the Debug Console to inspect browser state:

```javascript
// Get current browser snapshot
uploader.getBrowserSnapshot(true)

// Check for specific elements
uploader.findElementsInSnapshot(/img "(.*?\.jpg)"/)

// Check for upload errors
uploader.checkTextExists('Your file can\'t be uploaded:')

// Full inspection
uploader.inspectUploadState()
```

### 3. Agent-Browser Commands During Debug
You can also execute agent-browser commands directly in the terminal:

```bash
# Get current snapshot
agent-browser snapshot -i

# Check specific elements
agent-browser snapshot | grep "Remove Video"

# Check for upload errors
agent-browser snapshot | grep "Your file can't be uploaded"
```

## Key Debugging Scenarios

### Scenario 1: Browser State Inspection
When stopped at the first breakpoint (before browser opens):
- Check current working directory
- Verify agent-browser is accessible
- Confirm profile path is correct

### Scenario 2: Login Status Check
When stopped after browser opens:
- Use `uploader.getBrowserSnapshot(true)` to see current page
- Check if redirected to login page
- Verify session state

### Scenario 3: Upload Process Monitoring
During upload batches:
- Monitor file upload progress
- Check for error messages
- Inspect element references

### Scenario 4: Failed Upload Detection
In `manageFailUploads` method:
- Check for "Your file can't be uploaded:" text
- Find JPG files and their corresponding Remove Video buttons
- Verify list item structure parsing

## Common Debugging Commands

### In Debug Console:
```javascript
// Create uploader instance (if needed)
const uploader = new FacebookMediaUploader({
    folderPath: "your-folder-path",
    photoBatchSize: 50,
    videoBatchSize: 10
});

// Inspect current state
uploader.inspectUploadState();

// Get snapshot with interactive mode
uploader.getBrowserSnapshot(true);

// Check for specific patterns
uploader.findElementsInSnapshot(/button "Post" \[ref=([e\d]+)\]/);
```

### In Terminal:
```bash
# Manual snapshot inspection
agent-browser snapshot -i

# Check for specific elements
agent-browser snapshot | findstr "Remove Video"

# Check for errors
agent-browser snapshot | findstr "uploaded"
```

## Troubleshooting

### If debugger doesn't stop:
- Ensure `debugger;` statements are not commented out
- Check that `--inspect-brk` is in runtimeArgs
- Verify Node.js version compatibility

### If agent-browser commands fail:
- Check that agent-browser is in PATH
- Verify profile directory exists and is writable
- Ensure no other agent-browser sessions are running

### If breakpoints are not hit:
- Make sure you're debugging the correct configuration
- Check that the file path in launch.json matches your workspace
- Verify tsx is properly installed

## Memory and Performance Tips

- Use `snapshot -i` sparingly as it's interactive
- For performance monitoring, use non-interactive snapshots
- Clear breakpoints when not needed to avoid unnecessary stops
- Use conditional breakpoints for specific scenarios

## Next Steps

1. Start with "Debug Facebook Uploader - Main Script" configuration
2. Set additional breakpoints as needed in your specific workflow
3. Use the debug console methods to inspect browser state
4. Combine VS Code debugging with manual agent-browser commands for comprehensive inspection