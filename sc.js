const puppeteer = require('puppeteer');
const sharp = require('sharp');
const fs = require('fs');
const validUrl = require('valid-url');
const readline = require('readline');
const path = require('path');

const resolutions = {
    full: { width: 0, height: 0, deviceScaleFactor: 2 },
    desktop: { width: 1920, height: 1080, deviceScaleFactor: 2 },
    tablet: { width: 1366, height: 1024, deviceScaleFactor: 2 },
    mobile: { width: 430, height: 932, deviceScaleFactor: 2 }
};

async function screenshot(url, filePath, resolution) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    if (resolution) {
        await page.setViewport(resolution);
    }

    try {
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.goto(url, { timeout: 0 }),
        ]);

        // If resolution is 'full', wait for additional 50 seconds
        if (resolution.width === 0 && resolution.height === 0) {
            await new Promise(resolve => setTimeout(resolve, 50000));
        }

        const screenshotBuffer = await page.screenshot({ fullPage: resolution.width === 0 && resolution.height === 0 });

        const processedImageBuffer = await sharp(screenshotBuffer)
            .withMetadata({ density: resolution ? resolution.deviceScaleFactor * 72 : 72 })
            .toFormat('jpeg', { quality: 100 })
            .toBuffer();

        fs.writeFileSync(filePath, processedImageBuffer);

        console.log(`█ Screenshot for ${url} saved.`);
    } catch (error) {
        console.log(`⌗ Error with ${url}: ${error.message}`);
    } finally {
        await browser.close();
    }
}

async function processLineByLine(deviceType) {
    const fileStream = fs.createReadStream('list.txt');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        let url = line.trim();

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
        }

        if (!validUrl.isWebUri(url)) {
            console.log(`⌗ Invalid URL: ${url}`);
            continue;
        }

        const domainForFilename = new URL(url).hostname + new URL(url).pathname;
        const filePath = path.join('screenshots', `${domainForFilename.replace(/[^a-zA-Z0-9\-]/g, '_')}_${deviceType}.jpg`);

        if (fs.existsSync(filePath)) {
            console.log(`░ Screenshot for ${url} already exists. Omitted.`);
            continue;
        }

        await screenshot(url, filePath, resolutions[deviceType]);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n⊹ Screenshots have been saved.\n');
}

let deviceType = process.argv[2];
if (!deviceType || !resolutions[deviceType]) {
    console.log(`\n⌗ Invalid device type '${deviceType}'.\nPlease use one of the following: full, desktop, tablet, mobile.\n`);
    process.exit(1);
}

processLineByLine(deviceType);