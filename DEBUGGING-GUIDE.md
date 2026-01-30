# Facebook Uploader VS Code Debugging Guide

## Debugging Configurations

The launch.json file has been configured with 4 debugging options:

### 1. "Debug Facebook Uploader" 
- Basic debugging with stop on entry
- No pre-launch tasks
- Good for initial debugging

### 2. "Debug with Agent-Browser Snapshot Inspection"
- Runs cleanup task before debugging
- Automatically executes `agent-browser close`
- Good for clean debugging sessions

### 3. "Debug with Pre-cleanup and Snapshot"
- Same as above but with additional environment setup
- Uses TS_NODE_PROJECT environment variable

### 4. "Debug - Manual Agent-Browser Control"
- Stops on entry point
- No pre-launch tasks
- Allows manual agent-browser control during debugging

## Using Agent-Browser Snapshot for Debugging

During debugging, you can use these commands in the Debug Console or Terminal:

### Basic Snapshot Commands:
```bash
# Get current browser state
agent-browser snapshot

# Get interactive snapshot (includes element references)
agent-browser snapshot -i

# Get specific element information
agent-browser snapshot -i | findstr "ref="

# Check for specific elements
agent-browser snapshot | findstr "Post"
agent-browser snapshot | findstr "Remove Video"
agent-browser snapshot | findstr "\.jpg"
```

### Debugging Workflow:

1. **Start Debugging**: Select one of the debug configurations above
2. **Set Breakpoints**: Place breakpoints in fb-uploader.ts where you want to inspect
3. **Use Debug Console**: When stopped at breakpoints, use these commands:

```javascript
// In VS Code Debug Console, you can execute:
execSync('agent-browser snapshot', { encoding: 'utf-8' })
execSync('agent-browser snapshot -i', { encoding: 'utf-8' })

// Or create helper functions:
function getSnapshot() {
    return execSync('agent-browser snapshot', { encoding: 'utf-8' });
}

function getInteractiveSnapshot() {
    return execSync('agent-browser snapshot -i', { encoding: 'utf-8' });
}

// Check specific conditions:
const snapshot = getSnapshot();
console.log('Upload error present:', snapshot.includes('Your file can\'t be uploaded:'));
console.log('Post button refs:', snapshot.match(/button "Post"\s+\[ref=([e\d]+)\]/g));
```

### Key Debugging Points in fb-uploader.ts:

1. **findFailUpload() method** (line ~252):
   - Set breakpoint to see snapshot parsing
   - Inspect `snapshotOutput` variable
   - Check regex matching results

2. **manageFailUploads() method** (line ~102):
   - See collected failed uploads
   - Inspect the `failedUploads` array

3. **getRef() method** (line ~509):
   - See element reference finding
   - Inspect regex matching and retries

4. **uploadBatch() method** (line ~118):
   - Monitor upload process
   - Check Post button state

### Debugging Tips:

1. **Use the Debug Console**:
   ```
   // Check current browser state
   execSync('agent-browser snapshot -i', { encoding: 'utf-8' })
   
   // Check for specific elements
   const output = execSync('agent-browser snapshot', { encoding: 'utf-8' });
   console.log('JPG files found:', output.match(/img "(.*?\.jpg)"/g));
   ```

2. **Watch Variables**:
   - Add `snapshotOutput` to watch expressions
   - Monitor `failedUploads` array
   - Watch `postButtonRef` and other element references

3. **Conditional Breakpoints**:
   - Set breakpoints that only trigger when specific conditions are met
   - Example: Break when a specific JPG file is detected

4. **Step Through Code**:
   - Use Step Over (F10) to execute line by line
   - Use Step Into (F11) to enter function calls
   - Use Step Out (Shift+F11) to exit current function

### Common Debugging Scenarios:

**Scenario 1: Checking why failed uploads aren't detected**
```
// At findFailUpload breakpoint:
1. Check snapshotOutput variable content
2. Execute: execSync('agent-browser snapshot', { encoding: 'utf-8' })
3. Look for "Your file can't be uploaded:" text
4. Check if JPG files and Remove Video buttons are properly paired
```

**Scenario 2: Verifying element references**
```
// At getRef breakpoint:
1. Check the linkText and key parameters
2. Execute: execSync('agent-browser snapshot -i', { encoding: 'utf-8' })
3. Look for the specific element pattern in output
4. Verify the regex is matching correctly
```

**Scenario 3: Monitoring upload process**
```
// At uploadBatch breakpoint:
1. Check batch contents
2. Monitor Post button state changes
3. Verify file uploads are progressing
4. Check for error messages in snapshot
```

## Recommended Debugging Flow:

1. Start with "Debug - Manual Agent-Browser Control" configuration
2. Set breakpoints in key methods:
   - findFailUpload()
   - manageFailUploads() 
   - getRef()
   - uploadBatch()
3. Use Debug Console to execute agent-browser commands
4. Inspect variables and watch expressions
5. Step through code to understand execution flow