import * as fs from 'fs'
import * as path from 'path'
import { execSync, spawn } from 'child_process'
import * as dotenv from 'dotenv'
import { bgWhite, black, blue, red, green, yellow, cyan, magenta, gray } from 'chalkee'

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
    key?: 'link' | 'textbox' | 'dialog' | 'heading' | 'button' | 'img'  // Added 'img' option
    second?: number
    matchMode?: 'full' | 'partial'  // 'partial' matches anywhere in the text (default), 'full' matches exact text
}

export class FacebookMediaUploader {
    private folderPath: string
    private photoBatchSize: number
    private videoBatchSize: number
    private baseUrl: string
    private profilePath: string
    private sessionName: string
    private failedUploads: string[] = []  // Store only unique filenames
    private photoBatches: string[][] = []
    private videoBatches: string[][] = []

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
            const result = execSync(profileCommand, { stdio: 'inherit' })
            console.log(blue`Executing: `.bold(profileCommand))
            console.log(green`Command executed successfully`)
        } catch (error) {
            console.error(red(error))
            throw error
        }
    }

    async manageFailUploads(log = true): Promise<number> {
        if (log) console.log(magenta`Check for fail upload...`)
        const failedUploads = await this.findFailUpload()
        if (failedUploads) {
            console.log(yellow`Collected ${failedUploads.length} failed uploads:`)
            for (const { filename } of failedUploads) {
                console.log(yellow`  File: ${filename}`)
                // Find the ref for this filename from current snapshot
                const ref = await this.getRef(filename, { key: 'img', second: 5 })
                if (ref) {
                    // Click the ref to remove the media
                    const clickCommand = `agent-browser click ${ref}`
                    this.executeAgentBrowser(clickCommand)
                    console.log(green`Removed failed upload: ${filename}`)
                } else {
                    console.log(red`  Could not find ref for ${filename}`)
                }
            }
            // Keep track of all failed uploads (only unique filenames)
            for (const failedUpload of failedUploads) {
                if (!this.failedUploads.includes(failedUpload.filename)) {
                    this.failedUploads.push(failedUpload.filename)
                }
            }
            return failedUploads.length // Return the count of failed uploads
        }
        return 0 // Return 0 if no failed uploads
    }

    /**
     * Wait with a spinning fan animation
     */
    private async waitWithSpinner(durationMs: number, message?: any): Promise<void> {
        if (message) {
            process.stdout.write(message.toString())
        }
        const spinner = ['|', '/', '-', '—']
        const interval = 200 // Update every 200ms
        const iterations = durationMs / interval

        for (let i = 0; i < iterations; i++) {
            process.stdout.write(spinner[i % 4])
            process.stdout.moveCursor(-1, 0) // Move cursor back to overwrite the previous character
            await new Promise(resolve => setTimeout(resolve, interval))
        }

        // Clear the spinner character
        process.stdout.write(' ')
        process.stdout.moveCursor(-1, 0)

        if (message) {
            // Add a newline after the message
            console.log()
        }
    }

    /**
     * Upload a batch of files
     */
    private async uploadBatch(batch: string[], batchNo: number, type: 'photo' | 'video', albumName: string): Promise<boolean> {
        await this.clickOnAlbum(albumName)

        let addPhotosRef = await this.getRef("Add photos or videos", { key: 'link', second: 1 })
        if (!addPhotosRef) {
            throw new Error('Could not find "Add photos or videos" link')
        }
        this.click(addPhotosRef, 'Add photos or videos')


        // Convert file paths to forward slashes
        const normalizedPaths = batch.map(file => `"${this.normalizePath(file)}"`)
        const filesString = normalizedPaths.join(' ')

        // console.log(magenta('Waiting for file input...'))
        // this.executeAgentBrowser('agent-browser wait "input[multiple]"')
        await this.getRef('Upload photos or videos', { key: 'button', second: 10 })
        //wait another 10s 
        // await this.waitWithSpinner(10000, magenta`Waiting 10s for next batch...`)

        // Upload command
        const uploadCommand = `agent-browser upload "input[multiple]" ${filesString}`
        await this.executeUploadWithRetry(uploadCommand, 3)

        // Wait for upload to complete
        console.log(green`Waiting for upload to complete...`)
        const { postButtonRef, failUploadCount } = await this.waitForPostButton()

        try {
            //await this.waitWithSpinner(2000, magenta`Waiting for upload to complete...`)
            if (postButtonRef) {
                // Click Post button to finalize batch
                await this.isEnabled(postButtonRef)
                console.log(magenta`Waiting for upload to complete...`)
                this.click(postButtonRef, 'Post button')
                this.waitAddPhotos()
            }
        }
        catch (error) {
            //console.error(error)
        }

        addPhotosRef = await this.getRef("Add photos or videos", { key: 'link', second: 1 })
        if (!addPhotosRef) {
            console.log(red`Could not find "Add photos or videos" link, continuing...`)

            console.log(magenta`Reposting`)
            const repostRef = await this.getRef("Post", { key: 'button' })
            if (!repostRef) {
                console.log(red`Could not find Post button for reposting`)

                // Check for content unavailable error
                const snapshotCommand = `agent-browser snapshot`
                const snapshotOutput = execSync(snapshotCommand, { encoding: 'utf-8' })

                if (snapshotOutput.includes('Sorry, this content isn\'t available at this time')) {
                    console.log(yellow`Detected content unavailable error`)
                    console.log(magenta`Executing agent-browser back and reload...`)

                    // Execute agent-browser back
                    this.executeAgentBrowser('agent-browser back')

                    // Execute agent-browser reload
                    this.executeAgentBrowser('agent-browser reload')

                    console.log(green`Continuing to next batch...`)
                }
                else {
                    // check agent-browser snapshot,
                    // if last line:
                    //         - listitem
                    //         - listitem
                    //   - status "Loading..."
                    //   - text: Posting
                    //assume this batch is ok
                    // Execute agent-browser reload
                    const snapshotCommand = `agent-browser snapshot`
                    const snapshotOutput = execSync(snapshotCommand, { encoding: 'utf-8' })

                    // Split the output into lines
                    const lines = snapshotOutput.trim().split('\n')

                    // Check for the specific pattern in the last few lines
                    if (lines.length >= 4) {
                        const lastFourLines = lines.slice(-4)
                        const lastLine = lastFourLines[lastFourLines.length - 1].trim()
                        const secondLastLine = lastFourLines[lastFourLines.length - 2].trim()
                        const thirdLastLine = lastFourLines[lastFourLines.length - 3].trim()
                        const fourthLastLine = lastFourLines[lastFourLines.length - 4].trim()

                        // Check if the pattern matches: listitem, listitem, status "Loading...", text: Posting
                        if (lastLine.includes('text: Posting') &&
                            thirdLastLine.includes('status "Loading..."') &&
                            secondLastLine.includes('- listitem') &&
                            fourthLastLine.includes('- listitem')) {

                            this.executeAgentBrowser('agent-browser reload')
                            console.log(green`Assume this batch is OK, Continuing to next batch...`)
                        } else {
                            console.log(yellow`Pattern does not match, proceeding with reload...`)
                            this.executeAgentBrowser('agent-browser reload')
                            console.log(green`Reloaded, Continuing to next batch...`)
                        }
                    } else {
                        console.log(yellow`Snapshot has fewer than 4 lines, reloading...`)
                        this.executeAgentBrowser('agent-browser reload')
                        console.log(green`Reloaded, Continuing to next batch...`)
                    }
                }


                //return //continue next batch

                //throw new Error("Post button not found for reposting")
            }

            if (repostRef && await this.isEnabled(repostRef)) {
                this.click(repostRef, 'Repost')

                const oops = await this.getRef("Oops!", { key: 'heading', second: 60 })

                if (oops) {
                    console.log(magenta`Refresh Oops`)
                    this.executeAgentBrowser('agent-browser reload')
                    console.log(green`Assuming post succeeded`)
                    //return
                }
            }
            else {
                console.log(magenta`Posting hang...`)
                this.executeAgentBrowser('agent-browser reload')
                console.log(green`Assuming post succeeded`)
                //return
            }

        }


        //this.waitAddPhotos()

        //restart
        this.gotoAlbum()

        const success = this.compareAlbumCounts(albumName, batchNo, type)

        // this.clickOnAlbum(albumName)

        // console.error(red('Error clicking "Add photos or videos"'))

        return success

    }

    private waitAddPhotos() {
        console.log(magenta`Wait for Add photos or videos (max 2 minutes)`)
        const result = execSync(`agent-browser wait "text='Add photos or videos'"`)
        //console.log(result)
    }

    /**
     * Execute upload command with retry logic
     */
    private async executeUploadWithRetry(uploadCommand: string, maxRetries = 3): Promise<void> {

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(magenta`Upload attempt ${attempt}/${maxRetries}`)
                this.executeAgentBrowser(uploadCommand)
                return // Success, exit the retry loop
            } catch (error) {
                console.error(red(`Upload attempt ${attempt} failed:`), error)

                if (attempt < maxRetries) {
                    console.log(magenta`Retrying... Executing agent-browser back and reload...`)

                    // Execute agent-browser back
                    this.executeAgentBrowser('agent-browser back')

                    // Execute agent-browser reload
                    this.executeAgentBrowser('agent-browser reload')
                } else {
                    console.log(red`All ${maxRetries} upload attempts failed.`)
                    throw error // Re-throw the error after all retries are exhausted
                }
            }
        }
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
    private async waitForPostButton(): Promise<{ postButtonRef: string | null, failUploadCount: number }> {

        // Get the Post button reference using getRef
        const postButtonRef = await this.getRef("Post", { key: 'button', second: 10 })
        if (!postButtonRef) {
            console.log(red`Could not find Post button`)
            return { postButtonRef: null, failUploadCount: 0 }
        }

        console.log(magenta`Checking if Post button is enabled...`)
        // Poll for button to become enabled
        let failUploadCount = 0
        while (true) {
            try {
                if (await this.isEnabled(postButtonRef)) {
                    console.log(green`Post button is now enabled`)
                    return { postButtonRef, failUploadCount }
                }
                else
                    failUploadCount = await this.manageFailUploads(false)

                // else {
                //     console.log(yellow('Post button ', postButtonRef, 'is still not enabled. Waiting...'))
                // }

                // Wait a bit before checking again
                await this.waitWithSpinner(2000, ``)
            } catch (error) {
                console.error(red('Error checking if Post button is enabled:', error))
                return null
            }
        }
    }

    private async findFailUpload(): Promise<Array<{ filename: string }> | undefined> {
        const snapshotCommand = `agent-browser snapshot`
        try {
            const snapshotOutput = execSync(snapshotCommand, { encoding: 'utf-8' })

            // First check if there's an upload error message
            const errorMessageRegex = /- text: "Your file can't be uploaded:/
            const errorMessageRegex2 = /- text: "Your files can't be uploaded:/
            if (!errorMessageRegex.test(snapshotOutput) && !errorMessageRegex2.test(snapshotOutput)) {
                return undefined
            }

            // Check upload completion status BEFORE parsing list items
            // Look for "Description (optional)" textboxes to determine upload status

            // Extract all "Description (optional)" textboxes
            const allDescLines = snapshotOutput.match(/textbox "Description \(optional\)".*?$/gm) || []
            let hasDescNotDisabled = false
            let hasDescDisabled = false

            for (const line of allDescLines) {
                if (line.includes('[disabled]')) {
                    hasDescDisabled = true
                } else {
                    hasDescNotDisabled = true
                }
            }

            const tryAgainButtonRegex = /button "Try Again"/
            const hasTryAgainButton = tryAgainButtonRegex.test(snapshotOutput)

            // Check upload completion status based on requirements:
            // 1. All descriptions disabled + no "Try Again" = finish with fail upload (proceed to parse)
            // 2. Any description disabled without "Try Again" = still uploading (return undefined)
            // 3. Has "Try Again" button = upload finished (proceed to parse)

            // Check if ALL descriptions are disabled
            let allDescDisabled = true
            for (const line of allDescLines) {
                if (!line.includes('[disabled]')) {
                    allDescDisabled = false
                    break
                }
            }

            // Debug logging
            console.log(gray`Upload completion check:`)
            // console.log(gray`  hasTryAgainButton: ${hasTryAgainButton}`)
            // console.log(gray`  hasDescDisabled: ${hasDescDisabled}`)
            // console.log(gray`  allDescDisabled: ${allDescDisabled}`)

            // Look for the still uploading pattern: disabled description WITHOUT "Upload failed" text AND "Try Again" button
            let hasUploadingPattern = false
            if (hasDescDisabled) {
                // Check if the pattern exists in sequence
                const snapshotLines = snapshotOutput.split('\n')
                for (let i = 0; i < snapshotLines.length - 2; i++) {
                    const currentLine = snapshotLines[i].trim()
                    const nextLine = snapshotLines[i + 1].trim()
                    const nextNextLine = snapshotLines[i + 2].trim()

                    // Check for: disabled description WITHOUT "Upload failed" text AND "Try Again" button
                    // If these are NOT present, it means still uploading
                    if (currentLine.includes('Description (optional)') && currentLine.includes('[disabled]') &&
                        !nextLine.includes('text: Upload failed') &&
                        !nextNextLine.includes('button "Try Again"')) {
                        hasUploadingPattern = true
                        break
                    }
                }
            }

            console.log(gray`  hasUploadingPattern: ${hasUploadingPattern}`)

            // Apply the logic according to priority:
            if (hasUploadingPattern) {
                // First priority: Still uploading pattern found (no fail files)
                // console.log(gray`  -> First priority: Still uploading pattern found - return undefined`)
                return undefined
            }
            // Default: All descriptions enabled or has fail files - proceed to parse (upload finished)
            // console.log(gray`  -> Default: Has fail files or all enabled - upload finished`)

            // Parse the snapshot to find JPG files and their corresponding Remove Video buttons
            // Look for list items containing both img and Remove Video button
            const results: { filename: string }[] = []

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
                        // Check for "Upload failed" text in the same list item
                        let hasUploadFailed = false
                        // Look ahead in the same list item for "Upload failed" text
                        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                            const nextLine = lines[j].trim()
                            // Stop if we hit another list item
                            if (nextLine.startsWith('- listitem:')) break
                            // Check for "Upload failed" text
                            if (nextLine.includes('text: Upload failed')) {
                                hasUploadFailed = true
                                break
                            }
                        }

                        if (hasUploadFailed) {
                            results.push({ filename: currentFilename })
                        }
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

            // Upload is finished (either successful or failed)

            //console.log(gray(snapshotOutput))
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
                this.click(removeButtonRef, `Remove failed upload: ${filename}`)
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
        this.click(postButtonRef, 'Post button')
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
    private listAllFailedUploads(): void {
        if (this.failedUploads.length > 0) {
            console.log(yellow`All failed uploads across all batches:`)
            for (const filename of this.failedUploads) {
                console.log(yellow`  File: ${filename}`)
            }
        } else {
            console.log(green`No failed uploads detected across all batches`)
        }
    }

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
        this.photoBatches = this.createBatches(photos, this.photoBatchSize)
        this.videoBatches = this.createBatches(videos, this.videoBatchSize)

        console.log(yellow`Created ${this.photoBatches.length} photo batches of ${this.photoBatchSize} files each`)
        console.log(yellow`Created ${this.videoBatches.length} video batches of ${this.videoBatchSize} files each`)

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
        await this.waitWithSpinner(5000, yellow`Waiting for browser to open...`)

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

        this.gotoAlbum()

        await this.createAlbum(albumName)

        // await new Promise(resolve => setTimeout(resolve, 10000))
        //await this.getRef("Add photos or videos", { key: 'link', second: 10 })


        // Process photo batches first
        for (let i = 0; i < this.photoBatches.length; i++) {
            console.log(cyan`Uploading photo batch ${i + 1}/${this.photoBatches.length} (${this.photoBatches[i].length} files)`)

            let success = await this.uploadBatch(this.photoBatches[i], i, 'photo', albumName)
            let retryCount = 0
            const maxRetries = 3

            // Retry failed batches
            while (!success && retryCount < maxRetries) {
                retryCount++
                console.log(yellow`Photo batch ${i + 1} failed, retrying... (Attempt ${retryCount}/${maxRetries})`)
                await this.waitWithSpinner(5000, yellow`Waiting before retry...`)
                success = await this.uploadBatch(this.photoBatches[i], i, 'photo', albumName)
            }

            if (!success) {
                console.log(red`Photo batch ${i + 1} failed after ${maxRetries} attempts`)
                throw new Error(`Failed to upload photo batch ${i + 1} after ${maxRetries} retries`)
            }

            // // Add delay between batches
            // if (i < this.photoBatches.length - 1) {
            //     console.log(yellow('Waiting 10 seconds before next batch...'))
            //     await new Promise(resolve => setTimeout(resolve, 10000))
            // }
        }

        // Then process video batches
        for (let i = 0; i < this.videoBatches.length; i++) {
            console.log(cyan`Uploading video batch ${i + 1}/${this.videoBatches.length} (${this.videoBatches[i].length} files)`)

            let success = await this.uploadBatch(this.videoBatches[i], i, 'video', albumName)
            let retryCount = 0
            const maxRetries = 3

            // Retry failed batches
            while (!success && retryCount < maxRetries) {
                retryCount++
                console.log(yellow`Video batch ${i + 1} failed, retrying... (Attempt ${retryCount}/${maxRetries})`)
                await this.waitWithSpinner(5000, yellow`Waiting before retry...`)
                success = await this.uploadBatch(this.videoBatches[i], i, 'video', albumName)
            }

            if (!success) {
                console.log(red`Video batch ${i + 1} failed after ${maxRetries} attempts`)
                throw new Error(`Failed to upload video batch ${i + 1} after ${maxRetries} retries`)
            }

            // // Add delay between batches
            // if (i < this.videoBatches.length - 1) {
            //     console.log(yellow('Waiting 10 seconds before next batch...'))
            //     await new Promise(resolve => setTimeout(resolve, 10000))
            // }
        }

        console.log(green`All batches uploaded successfully!`)

        // List all failed uploads across all batches
        this.listAllFailedUploads()
    }

    /**
     * Navigate to the main albums page first
     */
    private gotoAlbum() {
        console.log(blue`Navigating to albums page: `.bold(this.baseUrl))
        const navigateCommand = `agent-browser open "${this.baseUrl}"`
        this.executeAgentBrowser(navigateCommand)
        this.executeAgentBrowser('agent-browser reload')
    }

    private async clickOnAlbum(albumName: string) {
        this.gotoAlbum()

        //click on the album
        const albumRef = await this.getRef(albumName, { matchMode: 'partial' })
        this.click(albumRef)
        this.waitAddPhotos()
    }

    private async createAlbum(albumName: string) {
        const createAlbumRef = await this.getRef("Create Album")
        if (!createAlbumRef) {
            throw new Error('Could not find "Create Album" button')
        }
        this.click(createAlbumRef, 'Create album')

        const albumNameRef = await this.getRef("Album name", { key: 'textbox' })
        if (!albumNameRef) {
            throw new Error('Could not find "Album name" textbox')
        }
        const fillAlbumNameCommand = `agent-browser fill ${albumNameRef} "${albumName}"`
        console.log(blue`Fill album name `.bold(fillAlbumNameCommand))
        this.executeAgentBrowser(fillAlbumNameCommand)

        const { postButtonRef: pb, failUploadCount } = await this.waitForPostButton()
        this.click(pb, 'Click Post button')
        this.waitAddPhotos()
    }

    /**
     * Helper method to click on an element with optional message
     */
    private click(ref: string | null, message?: string): void {
        if (ref) {
            if (message) {
                console.log(blue`${message} `.bold(ref))
            }
            this.executeAgentBrowser(`agent-browser click ${ref}`)
        }
    }

    /**
     * Navigate to album page
     */
    private async getRef(linkText: string, options: GetRefOptions = {}): Promise<string | null> {
        const { key = 'link', second = 10, matchMode = 'partial' } = options
        // Looking at the selected code, I need to implement a retry mechanism that tries 20 times with 100ms waits between attempts to find the "Add photos or videos" link.Here's the rewritten code:

        // Try for the specified number of seconds with 100ms wait between attempts
        const maxAttempts = second * 5 // 10 attempts per second

        // Show initial waiting message
        process.stdout.write(yellow(`getRef Waiting "${linkText}" ${key}... `).toString())

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 200))

            // Click "Add photos or videos"
            const addPhotosSnapshot = `agent-browser snapshot` + (key !== 'heading' && key !== 'img' ? ' -i' : '')
            const addPhotosOutput = execSync(addPhotosSnapshot, { encoding: 'utf-8' })

            let regexPattern: string
            if (matchMode === 'full') {
                // For full match, match the exact text
                regexPattern = `${key} "${linkText}"[^\\[]*\\[ref=([e\\d]+)\\]`
            } else {
                // For partial match, match text that contains the linkText anywhere
                regexPattern = `${key} "([^"]*${linkText}[^"]*)"[^\\[]*\\[ref=([e\\d]+)\\]`
            }

            const addPhotosMatch = addPhotosOutput.match(new RegExp(regexPattern))
            if (addPhotosMatch) {
                // For full match, ref is in group [1], for partial match, ref is in group [2]
                const addPhotosRef = matchMode === 'full' ? addPhotosMatch[1] : addPhotosMatch[2]
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

    /**
     * Parse album information from snapshot output
     */
    private parseAlbumInfo(albumName: string): { photos: number, videos: number, total: number, ref: string } | null {
        const snapshotCommand = `agent-browser snapshot`
        const snapshotOutput = execSync(snapshotCommand, { encoding: 'utf-8' })

        const lines = snapshotOutput.split('\n')

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()

            // Look for the link line containing the album name
            if (line.includes(`link "${albumName}`) && line.includes('[ref=')) {
                // Extract ref
                const refMatch = line.match(/\[ref=([e\d]+)\]/)
                if (!refMatch) continue

                const ref = refMatch[1]

                // Look for the text line 3 lines below (based on the sample structure)
                const textLineIndex = i + 3
                if (textLineIndex >= lines.length) continue

                const textLine = lines[textLineIndex].trim()
                if (!textLine.includes('text:')) continue

                // Parse counts from text like "20180620 Family trip China Day 11 50 photos"
                // or "20180619 Family trip China Day 10 357 photos 9 videos"
                const textContent = textLine.replace('text:', '').trim()

                // Extract numbers from the end of the text
                const numbers = textContent.match(/(\d+)\s+photos(?:\s+(\d+)\s+videos)?/)
                if (!numbers) continue

                const photos = parseInt(numbers[1], 10)
                const videos = numbers[2] ? parseInt(numbers[2], 10) : 0
                const total = photos + videos

                return {
                    photos,
                    videos,
                    total,
                    ref
                }
            }
        }

        return null
    }

    /**
     * Compare album counts with expected batch information
     */
    private compareAlbumCounts(albumName: string, batchNo: number, type: 'photo' | 'video'): boolean {
        const albumInfo = this.parseAlbumInfo(albumName)
        if (albumInfo) {
            const { photos, videos, total, ref } = albumInfo

            // Calculate cumulative expected counts based on batch type
            // For photo batches: count photo batches up to the current batchNo (inclusive)
            // For video batches: count all photo batches + video batches up to the current batchNo (inclusive)
            let expectedPhotos = 0
            let expectedVideos = 0

            if (type === 'photo') {
                // Count photo batches from 0 to batchNo (inclusive)
                expectedPhotos = this.photoBatches.slice(0, batchNo + 1).reduce((sum, batch) => sum + batch.length, 0)
                // No video batches processed yet when handling photo batches
                expectedVideos = 0
            } else { // type === 'video'
                // Include all photo batches (they are processed first)
                expectedPhotos = this.photoBatches.reduce((sum, batch) => sum + batch.length, 0)
                // Count video batches from 0 to batchNo (inclusive)
                expectedVideos = this.videoBatches.slice(0, batchNo + 1).reduce((sum, batch) => sum + batch.length, 0)
            }

            const expectedTotal = expectedPhotos + expectedVideos

            console.log(cyan`Expected up to ${type} batch ${batchNo}: ${expectedPhotos} photos, ${expectedVideos} videos, ${expectedTotal} total`)
            console.log(cyan`Actual: ${photos} photos, ${videos} videos, ${total} total`)

            // Get the count of failed uploads from the class variable
            const failedUploadsCount = this.failedUploads.length
            console.log(cyan`Total failed uploads collected so far: ${failedUploadsCount}`)

            // Adjust the expected count by the total failed uploads
            const adjustedExpectedPhotos = expectedPhotos - failedUploadsCount
            const adjustedExpectedTotal = expectedTotal - failedUploadsCount

            console.log(cyan`Adjusted expected (after removing ${failedUploadsCount} total failed uploads): ${adjustedExpectedPhotos} photos, ${expectedVideos} videos, ${adjustedExpectedTotal} total`)

            if (photos === adjustedExpectedPhotos && videos === expectedVideos) {
                console.log(green`✅ Album counts match expected batch counts (adjusted for failed uploads)!`)
                //this.click(ref)
                return true
            } else {
                console.log(yellow`⚠️  Album counts don't match expected batch counts`)
                if (photos !== adjustedExpectedPhotos) {
                    console.log(red`  Photos mismatch: expected ${adjustedExpectedPhotos}, got ${photos}`)
                }
                if (videos !== expectedVideos) {
                    console.log(red`  Videos mismatch: expected ${expectedVideos}, got ${videos}`)
                }
                return false
            }
        } else {
            console.log(red`Could not parse album information`)
            return false
        }
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

