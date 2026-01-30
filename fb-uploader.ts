import * as fs from 'fs'
import * as path from 'path'
import { execSync, spawn } from 'child_process'
import * as dotenv from 'dotenv'
import { bgWhite, black, blue, red, green, yellow, cyan, magenta } from 'chalkee'

// Load environment variables
dotenv.config()

interface UploadOptions {
    folderPath: string
    photoBatchSize?: number
    videoBatchSize?: number
    sessionName?: string
    baseUrl?: string
    profilePath?: string
}

interface GetRefOptions {
    key?: 'link' | 'textbox' | 'dialog' | 'heading' | 'button'
    second?: number
}

class FacebookMediaUploader {
    private folderPath: string
    private photoBatchSize: number
    private videoBatchSize: number
    private sessionName: string
    private baseUrl: string
    private profilePath: string

    constructor(options: UploadOptions) {
        this.folderPath = options.folderPath
        this.photoBatchSize = options.photoBatchSize || 50
        this.videoBatchSize = options.videoBatchSize || 10
        this.sessionName = options.sessionName || 'default'
        this.baseUrl = options.baseUrl || process.env.FACEBOOK_ALBUMS_URL || 'https://www.facebook.com/groups/1085973312445186/media/albums'
        this.profilePath = options.profilePath || process.env.FACEBOOK_PROFILE_PATH || path.join(process.env.USERPROFILE || process.env.HOME || 'C:\Users\Default', '.facebook-uploader-profile')
    }

    /**
     * Get all media files from the folder
     */
    private getMediaFiles(): { photos: string[], videos: string[] } {
        const photoExtensions = ['.jpg', '.jpeg', '.png', '.gif']
        const videoExtensions = ['.mp4', '.mov', '.avi']
        const files = fs.readdirSync(this.folderPath)

        const photos = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase()
                return photoExtensions.includes(ext)
            })
            .map(file => path.join(this.folderPath, file))

        const videos = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase()
                return videoExtensions.includes(ext)
            })
            .map(file => path.join(this.folderPath, file))

        return { photos, videos }
    }

    /**
     * Split files into batches
     */
    private createBatches(files: string[], batchSize: number): string[][] {
        const batches: string[][] = []

        for (let i = 0; i < files.length; i += batchSize) {
            batches.push(files.slice(i, i + batchSize))
        }

        return batches
    }

    /**
     * Convert Windows paths to forward slashes for agent-browser
     */
    private normalizePath(filePath: string): string {
        return filePath.replace(/\\/g, '/')
    }

    /**
     * Execute agent-browser command
     */
    private executeAgentBrowser(command: string): void {
        try {
            // Ensure the command uses the profile if it's a session command
            const profileCommand = command
            console.log(blue`Executing: `.bold(profileCommand))
            const result = execSync(profileCommand, { stdio: 'inherit' })
            console.log(green`Command executed successfully`)
        } catch (error) {
            console.error(red(error))
            throw error
        }
    }

    async manageFailUploads() {
        console.log(magenta`Check for fail upload...`)
        const failedUploads = await this.findFailUpload()
        if (failedUploads) {
            console.log(yellow`Collected ${failedUploads.length} failed uploads:`)
            for (const { ref, filename } of failedUploads) {
                console.log(yellow`  File: ${filename}, Ref: ${ref}`)
            }
            // Note: Will remove failed uploads in future implementation
            return
        }
    }

    /**
     * Upload a batch of files
     */
    private async uploadBatch(batch: string[]): Promise<void> {
        // Convert file paths to forward slashes
        const normalizedPaths = batch.map(file => `"${this.normalizePath(file)}"`)
        const filesString = normalizedPaths.join(' ')

        // console.log(magenta('Waiting for file input...'))
        // this.executeAgentBrowser('agent-browser wait "input[multiple]"')
        await this.getRef('Upload photos or videos', { key: 'button', second: 10 })
        //wait another 10s 
        console.log(magenta`Waiting 10s for next batch...`)
        await new Promise(resolve => setTimeout(resolve, 10000))

        // Upload command
        const uploadCommand = `agent-browser upload "input[multiple]" ${filesString}`
        this.executeAgentBrowser(uploadCommand)

        // Wait for upload to complete
        console.log(green`Waiting for upload to complete...`)
        let postButtonRef = await this.waitForPostButton()

        try {
            await new Promise(resolve => setTimeout(resolve, 2000))
            if (postButtonRef) {
                // Click Post button to finalize batch
                await this.isEnabled(postButtonRef)
                await this.clickPostButton()
            }
        }
        catch (error) {
            console.error(error)
        }

        console.log(magenta`Wait for 2 minutes`)

        //if Post button still there
        postButtonRef = await this.getRef("Post", { key: 'button', second: 10 })
        if (postButtonRef && !(await this.isEnabled(postButtonRef)))
            await this.manageFailUploads()


        const addPhotosRef = await this.getRef("Add photos or videos", { key: 'link', second: 120 })
        if (!addPhotosRef) {
            console.log(red`Could not find "Add photos or videos" link, continuing...`)
            return
        }

        const clickAddPhotosCommand = `agent-browser click ${addPhotosRef}`
        try {
            this.executeAgentBrowser(clickAddPhotosCommand)
        } catch (error) {
            console.log(magenta`Reposting`)
            const repostRef = await this.getRef("Post", { key: 'button' })
            if (!repostRef) {
                console.log(red`Could not find Post button for reposting`)
                throw error
            }
            const repostCommand = `agent-browser click ${repostRef}`
            this.executeAgentBrowser(repostCommand)

            const oops = await this.getRef("Oops!", { key: 'heading', second: 10 })

            if (oops) {
                console.log(magenta`Refresh Oops`)
                this.executeAgentBrowser('agent-browser reload')
                console.log(green`Assuming post succeeded`)
                return
            }
            else
                console.error(red('Error clicking "Add photos or videos":', error))
        }
        await new Promise(resolve => setTimeout(resolve, 2000))

        // console.log(blue(`Waiting for Creating album...`))
        // await new Promise(resolve => setTimeout(resolve, 10000))
        // await this.getRef("Add photos or videos", 'link', 10)

        return //successs
    }

    /**
     * Wait for Post button to become enabled
     */
    private async isEnabled(elementRef: string): Promise<boolean> {
        try {
            const snapshotCommand = `agent-browser snapshot -i`
            const snapshotOutput = execSync(snapshotCommand, { encoding: 'utf-8' })

            // Look for the button with the specific ref and check if it has [disabled] attribute
            const disabledRegex = new RegExp(`button "Post"\\s+\\[ref=${elementRef}\\]\\s+\\[disabled\\]`)
            const match = disabledRegex.test(snapshotOutput)

            // Return false if [disabled] is found (meaning it's disabled)
            // Return true if [disabled] is not found (meaning it's enabled)
            return !match
        } catch (error) {
            console.error(red('Error checking if element is enabled:', error))
            return false
        }
    }

    // console.log(magenta`Waiting for Post button to be enabled...`)
    private async waitForPostButton(): Promise<string | null> {

        // Get the Post button reference using getRef
        const postButtonRef = await this.getRef("Post", { key: 'button', second: 10 })
        if (!postButtonRef) {
            console.log(red`Could not find Post button`)
            return null
        }

        console.log(magenta`Checking if Post button is enabled...`)
        // Poll for button to become enabled
        while (true) {
            try {
                if (await this.isEnabled(postButtonRef)) {
                    console.log(green`Post button is now enabled`)
                    return postButtonRef
                }
                else
                    await this.manageFailUploads()

                // else {
                //     console.log(yellow('Post button ', postButtonRef, 'is still not enabled. Waiting...'))
                // }

                // Wait a bit before checking again
                await new Promise(resolve => setTimeout(resolve, 2000))
            } catch (error) {
                console.error(red('Error checking if Post button is enabled:', error))
                return null
            }
        }
    }

    /**
     * Debug helper method to get current browser snapshot
     * Use this in debug console to inspect browser state
     */
    public getBrowserSnapshot(interactive: boolean = false): string {
        const command = `agent-browser snapshot${interactive ? ' -i' : ''}`;
        try {
            return execSync(command, { encoding: 'utf-8' });
        } catch (error) {
            console.error('Error getting browser snapshot:', error);
            return '';
        }
    }

    /**
     * Debug helper to check for specific elements
     */
    public findElementsInSnapshot(pattern: string | RegExp): string[] {
        const snapshot = this.getBrowserSnapshot();
        if (typeof pattern === 'string') {
            pattern = new RegExp(pattern, 'g');
        }
        const matches = snapshot.match(pattern);
        return matches || [];
    }

    /**
     * Debug helper to check if specific text exists
     */
    public checkTextExists(text: string): boolean {
        const snapshot = this.getBrowserSnapshot();
        return snapshot.includes(text);
    }

    /**
     * Debug helper to inspect current upload state
     */
    public inspectUploadState(): void {
        console.log('=== Browser State Inspection ===');
        
        // Get interactive snapshot
        const interactiveSnapshot = this.getBrowserSnapshot(true);
        console.log('Interactive Snapshot:', interactiveSnapshot.substring(0, 500) + '...');
        
        // Check for upload errors
        const hasUploadError = this.checkTextExists('Your file can\'t be uploaded:');
        console.log('Upload Error Present:', hasUploadError);
        
        // Find JPG files
        const jpgFiles = this.findElementsInSnapshot(/img "(.*?\.jpg)"/);
        console.log('JPG Files Found:', jpgFiles);
        
        // Find Remove Video buttons
        const removeButtons = this.findElementsInSnapshot(/button "Remove Video" \[ref=([e\d]+)\]/);
        console.log('Remove Video Buttons:', removeButtons);
        
        // Find Post buttons
        const postButtons = this.findElementsInSnapshot(/button "Post" \[ref=([e\d]+)\]/);
        console.log('Post Buttons:', postButtons);
        
        console.log('=== End Inspection ===');
    }

    private async findFailUpload(): Promise<Array<{ ref: string, filename: string }> | undefined> {
        const snapshotCommand = `agent-browser snapshot`
        try {
            const snapshotOutput = execSync(snapshotCommand, { encoding: 'utf-8' })

            // First check if there's an upload error message
            const errorMessageRegex = /- text: "Your file can't be uploaded:/
            if (!errorMessageRegex.test(snapshotOutput)) {
                return undefined
            }

            // Parse the snapshot to find JPG files and their corresponding Remove Video buttons
            // Look for list items containing both img and Remove Video button
            const results: Array<{ ref: string, filename: string }> = []

            // Split the snapshot into lines for easier parsing
            const lines = snapshotOutput.split('\n')

            // Process each list item separately
            let inListItem = false
            let currentFilename = ''

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim()

                // Detect list item start
                if (line.startsWith('- listitem:')) {
                    inListItem = true
                    currentFilename = ''
                    continue
                }

                // If we're in a list item, look for img and button
                if (inListItem) {
                    // Look for img lines containing .jpg files
                    const imgMatch = line.match(/img "(.*?\.jpg)"/)
                    if (imgMatch) {
                        currentFilename = imgMatch[1]
                        continue
                    }

                    // Look for Remove Video button
                    const buttonMatch = line.match(/- button "Remove Video" \[ref=([e\d]+)\]/)
                    if (buttonMatch && currentFilename) {
                        const ref = buttonMatch[1]
                        results.push({ ref, filename: currentFilename })
                        inListItem = false // Reset for next list item
                        currentFilename = ''
                        continue
                    }

                    // Detect end of list item (next listitem or end of section)
                    if (line.startsWith('- listitem:') || (line === '' && i < lines.length - 1 && lines[i + 1].trim().startsWith('-'))) {
                        inListItem = false
                        currentFilename = ''
                    }
                }
            }

            return results.length > 0 ? results : undefined
        } catch (error) {
            console.error(red('Error finding failed uploads:', error))
        }
    }

    private async removeFailedUpload(filename: string): Promise<void> {
        try {
            // Find the Remove Video button for this specific file
            const removeButtonRef = await this.getRef("Remove Video", { key: 'button', second: 10 })
            if (removeButtonRef) {
                const clickCommand = `agent-browser click ${removeButtonRef}`
                this.executeAgentBrowser(clickCommand)
                console.log(green`Removed failed upload: ${filename}`)
            }
        } catch (error) {
            console.error(red(`Error removing failed upload ${filename}:`, error))
        }
    }


    /**
     * Click the Post button
     */
    private async clickPostButton(): Promise<void> {
        // Get the Post button reference using getRef
        const postButtonRef = await this.getRef("Post", { key: 'button', second: 10 })
        if (!postButtonRef) {
            console.log(red`Could not find Post button`)
            return
        }
        const clickCommand = `agent-browser click ${postButtonRef}`
        this.executeAgentBrowser(clickCommand)
        console.log(green`Post button clicked successfully`)
    }

    /**
     * Wait for user confirmation before proceeding
     */
    private async waitForUserConfirmation(): Promise<void> {
        return new Promise((resolve) => {
            const readline = require('readline')
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            })

            rl.question('Press Enter to continue after logging in to Facebook... ', (answer: string) => {
                rl.close()
                resolve()
            })
        })
    }

    /**
     * Main upload process
     */
    public async uploadMedia(albumName: string): Promise<void> {
        console.log(blue`Starting upload process for folder: `.bold(this.folderPath))

        // Validate folder exists
        if (!fs.existsSync(this.folderPath)) {
            throw new Error(`Folder does not exist: ${this.folderPath}`)
        }

        // Get all media files
        const { photos, videos } = this.getMediaFiles()
        console.log(green`Found ${photos.length} photos and ${videos.length} videos`)

        if (photos.length === 0 && videos.length === 0) {
            console.log(yellow`No media files found in the specified folder`)
            return
        }

        // Create batches for photos and videos separately
        const photoBatches = this.createBatches(photos, this.photoBatchSize)
        const videoBatches = this.createBatches(videos, this.videoBatchSize)

        console.log(yellow`Created ${photoBatches.length} photo batches of ${this.photoBatchSize} files each`)
        console.log(yellow`Created ${videoBatches.length} video batches of ${this.videoBatchSize} files each`)

        // Close any existing agent-browser sessions to ensure clean state with profile
        // try {
        //     console.log(yellow('Closing existing browser sessions...'))
        //     const closeCommand = `agent-browser close`
        //     execSync(closeCommand, { stdio: 'pipe' })
        //     console.log(green('Closed existing sessions'))
        // } catch (error) {
        //     // Ignore errors if no sessions were running
        //     console.log(blue('No existing sessions to close'))
        // }

        // Open the base URL and check if we're logged in
        console.log(yellow`Checking Facebook login status...`)
        const openCommand = `agent-browser --headed --profile "${this.profilePath}" --session ${this.sessionName} open "${this.baseUrl}"`
        console.log(blue`Profile path: `.bold(this.profilePath))
        console.log(blue`Open command: `.bold(openCommand))
        const { exec } = require('child_process')
        exec(openCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(red('Error opening browser:', error))
            }
        })
        // Wait for the browser to open
        await new Promise(resolve => setTimeout(resolve, 5000))

        console.log(yellow`Browser opened, checking login status...`)

        // Take a snapshot to see if we're on the login page or album page
        const snapshotCommand = `agent-browser --session ${this.sessionName} snapshot`
        const snapshotOutput = execSync(snapshotCommand, { encoding: 'utf-8' })

        // Check if we're on a login page (redirected due to not being logged in)
        if (snapshotOutput.includes('Log in') ||
            snapshotOutput.includes('Sign in') ||
            snapshotOutput.includes('log in') ||
            snapshotOutput.toLowerCase().includes('sign up') ||
            snapshotOutput.toLowerCase().includes('login')) {

            console.log(red`Not logged in to Facebook. Opening browser for login...`)
            // Launch the browser in headed mode for login with profile
            const launchCommand = `agent-browser open "${this.baseUrl}"`
            console.log(blue`Executing: `.bold(launchCommand))
            execSync(launchCommand, { stdio: 'inherit' })

            console.log(yellow`Please log in to Facebook in the opened browser window, then close the browser.`)
            await this.waitForUserConfirmation()
        } else {
            console.log(green`Already logged in to Facebook - session preserved`)
        }

        // Navigate to the main albums page first
        console.log(blue`Navigating to albums page: `.bold(this.baseUrl))
        const navigateCommand = `agent-browser open "${this.baseUrl}"`
        this.executeAgentBrowser(navigateCommand)

        const createAlbumRef = await this.getRef("Create Album")
        if (!createAlbumRef) {
            throw new Error('Could not find "Create Album" button')
        }
        console.log(blue`Create album `.bold(createAlbumRef))
        const clickCreateAlbumCommand = `agent-browser click ${createAlbumRef}`
        this.executeAgentBrowser(clickCreateAlbumCommand)

        const albumNameRef = await this.getRef("Album name", { key: 'textbox' })
        if (!albumNameRef) {
            throw new Error('Could not find "Album name" textbox')
        }
        const fillAlbumNameCommand = `agent-browser fill ${albumNameRef} "${albumName}"`
        console.log(blue`Fill album name `.bold(fillAlbumNameCommand))
        this.executeAgentBrowser(fillAlbumNameCommand)

        const pb = await this.waitForPostButton()
        const pbCommand = `agent-browser click ${pb}`
        console.log(blue`Click Post button `.bold(pbCommand))
        this.executeAgentBrowser(pbCommand)

        const addPhotosRef = await this.getRef("Add photos or videos")
        if (!addPhotosRef) {
            throw new Error('Could not find "Add photos or videos" link')
        }
        const clickAddPhotosCommand = `agent-browser click ${addPhotosRef}`
        this.executeAgentBrowser(clickAddPhotosCommand)

        console.log(blue`Waiting for Creating album...`)
        // await new Promise(resolve => setTimeout(resolve, 10000))
        await this.getRef("Add photos or videos", { key: 'link', second: 10 })


        // Process photo batches first
        for (let i = 0; i < photoBatches.length; i++) {
            console.log(cyan`Uploading photo batch ${i + 1}/${photoBatches.length} (${photoBatches[i].length} files)`)

            await this.uploadBatch(photoBatches[i])

            // // Add delay between batches
            // if (i < photoBatches.length - 1) {
            //     console.log(yellow('Waiting 10 seconds before next batch...'))
            //     await new Promise(resolve => setTimeout(resolve, 10000))
            // }
        }

        // Then process video batches
        for (let i = 0; i < videoBatches.length; i++) {
            console.log(cyan`Uploading video batch ${i + 1}/${videoBatches.length} (${videoBatches[i].length} files)`)

            await this.uploadBatch(videoBatches[i])

            // // Add delay between batches
            // if (i < videoBatches.length - 1) {
            //     console.log(yellow('Waiting 10 seconds before next batch...'))
            //     await new Promise(resolve => setTimeout(resolve, 10000))
            // }
        }

        console.log(green`All batches uploaded successfully!`)
    }

    private async getRef(linkText: string, options: GetRefOptions = {}): Promise<string | null> {
        const { key = 'link', second = 10 } = options
        // Looking at the selected code, I need to implement a retry mechanism that tries 20 times with 100ms waits between attempts to find the "Add photos or videos" link.Here's the rewritten code:

        // Try for the specified number of seconds with 100ms wait between attempts
        const maxAttempts = second * 5 // 10 attempts per second

        // Show initial waiting message
        process.stdout.write(yellow(`getRef Waiting "${linkText}" ${key}... `).toString())

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 200))

            // Click "Add photos or videos"
            const addPhotosSnapshot = `agent-browser snapshot` + (key !== 'heading' ? ' -i' : '')
            const addPhotosOutput = execSync(addPhotosSnapshot, { encoding: 'utf-8' })

            const addPhotosMatch = addPhotosOutput.match(new RegExp(`${key} "${linkText}"\\s+\\[ref=([e\\d]+)\\]`))
            if (addPhotosMatch) {
                const addPhotosRef = addPhotosMatch[1]
                console.log() // New line after dots
                return addPhotosRef
            }

            // Add a spinning fan character for each retry attempt
            const spinner = ['|', '/', '-', '\\']
            process.stdout.write(spinner[attempt % 4])
            process.stdout.moveCursor(-1, 0) // Move cursor back to overwrite the previous character

            // process.stdout.write('.')
        }

        // New line after all dots
        console.log()

        console.log(red`Could not find "${linkText}" ${key} after ${second} seconds`)
        return null
    }
}

/**
 * Parse command line arguments
 */
function parseArgs(): UploadOptions {
    const args = process.argv.slice(2)

    // Check for help
    if (args.includes('--help') || args.includes('-h')) {
        console.log(bgWhite(black(`Usage: tsx fb-uploader.ts <folder-path> [options]`)))
        console.log(yellow('\nOptions:'))
        console.log(cyan`  --photo-batch-size, -p   `.r`Batch size for photos (default: 50)`)
        console.log(cyan`  --video-batch-size, -v   `.r`Batch size for videos (default: 10)`)
        console.log(cyan`  --base-url, -b           `.r`Base URL for Facebook albums (default: from .env)`)
        console.log(cyan`  --session, -s            `.r`Session name for agent-browser (default: \'default\')`)
        console.log(cyan`  --profile-path, -pp      `.r`Profile path for agent-browser (default: from .env)`)
        console.log(cyan`  --help, -h               `.r`Show this help message`)
        console.log(yellow`\nExamples:`)
        console.log(yellow`  tsx`.r` fb-uploader.ts `.blue`"I:/Photos/MyAlbum"`)
        console.log(yellow`  tsx`.r` fb-uploader.ts `.blue`"I:/Photos/MyAlbum" `.d`--photo-batch-size `.r`30`)
        console.log(yellow`  tsx`.r` fb-uploader.ts `.blue`"I:/Photos/MyAlbum" `.d`--video-batch-size `.r`5`)
        console.log(yellow`  tsx`.r` fb-uploader.ts `.blue`"I:/Photos/MyAlbum"`.r.d` --photo-batch-size `.r`25 `.r.d`--video-batch-size `.r`8 `.r.d`--session `.r`my-session `.r.d`--base-url `.r.blue`"https://www.facebook.com/groups/123456789/media/albums"`.r.d` --profile-path `.r.blue`"C:/custom/profile"`)
        process.exit(0)
    }

    if (args.length < 1) {
        console.error(red`Usage: npx tsx fb-uploader.ts <folder-path> [options]`)
        console.error(yellow`Use --help for more information`)
        process.exit(1)
    }

    let folderPath = args[0]
    let photoBatchSize = 50
    let videoBatchSize = 10
    let baseUrl: string | undefined = undefined
    let sessionName = 'default'
    let profilePath: string | undefined = undefined

    // Parse additional options
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--photo-batch-size' || args[i] === '-p') {
            photoBatchSize = parseInt(args[i + 1])
            i++ // Skip next argument
        } else if (args[i] === '--video-batch-size' || args[i] === '-v') {
            videoBatchSize = parseInt(args[i + 1])
            i++ // Skip next argument
        } else if (args[i] === '--base-url' || args[i] === '-b') {
            baseUrl = args[i + 1]
            i++ // Skip next argument
        } else if (args[i] === '--session' || args[i] === '-s') {
            sessionName = args[i + 1]
            i++ // Skip next argument
        } else if (args[i] === '--profile-path' || args[i] === '-pp') {
            profilePath = args[i + 1]
            i++ // Skip next argument
        }
    }

    return { folderPath, photoBatchSize, videoBatchSize, baseUrl, sessionName, profilePath }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    try {
        const options = parseArgs()
        const uploader = new FacebookMediaUploader({
            folderPath: options.folderPath,
            photoBatchSize: options.photoBatchSize,
            videoBatchSize: options.videoBatchSize,
            baseUrl: options.baseUrl,
            sessionName: options.sessionName
        })

        // Extract album name from folder path
        const albumName = path.basename(options.folderPath)
        console.log(blue`Using album name: `.bold(albumName))

        await uploader.uploadMedia(albumName)
        process.exit(1)
    } catch (error) {
        console.error(red`Upload process failed:`.bold(error))
        process.exit(1)
    }
}

// Execute if this file is run directly
if (require.main === module) {
    main()
}

export { FacebookMediaUploader, UploadOptions, GetRefOptions }