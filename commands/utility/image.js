const { SlashCommandBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const http = require('http');
const { URL } = require('url');
const imageBuffer = require('./imageBuffer'); // Import the shared image buffer

function getRGBBase64(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    let rgbBuffer = Buffer.alloc(64 * 64 * 3);
    let offset = 0;

    for (let i = 0; i < data.length; i += 4) {
        rgbBuffer.writeUInt8(data[i], offset++);     // Red
        rgbBuffer.writeUInt8(data[i + 1], offset++); // Green
        rgbBuffer.writeUInt8(data[i + 2], offset++); // Blue
    }

    return rgbBuffer.toString('base64'); 
}

function applyDithering(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const index = (y * width + x) * 4;

            const oldPixel = data[index];
            const newPixel = oldPixel < 128 ? 0 : 255; // Threshold for dithering
            const error = oldPixel - newPixel;

            data[index] = newPixel; // Red
            data[index + 1] = newPixel; // Green
            data[index + 2] = newPixel; // Blue

            if (x + 1 < width) data[index + 4] += (error * 7) / 16;
            if (y + 1 < canvas.height) {
                if (x > 0) data[index + (width - 1) * 4] += (error * 3) / 16;
                data[index + width * 4] += (error * 5) / 16;
                if (x + 1 < width) data[index + (width + 1) * 4] += (error * 1) / 16;
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function applyGrayscale(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;     // Red
        data[i + 1] = avg; // Green
        data[i + 2] = avg; // Blue
    }

    ctx.putImageData(imageData, 0, 0);
}

function resetgifid() {
    const payload = JSON.stringify({
        Command: "Draw/ResetHttpGifId"
    });

    const url = new URL(`http://${process.env.PIXOO_IP}:80/post`);
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };
    const req = http.request(url, options, res => {
        let responseData = '';

        res.on('data', chunk => {
            responseData += chunk;
        });

        res.on('end', () => {
            console.log('Response status:', res.statusCode);
            console.log('Response data:', responseData);
        });
    });

    req.on('error', error => {
        console.error('Failed to send message:', error.message);
    });

    req.write(payload); 
    req.end();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription('Resize an image to 64x64 and send it to Pixoo')
        .addAttachmentOption(option => 
            option.setName('image')
                .setDescription('The image to process')
                .setRequired(true)),
    async execute(interaction) {
        const attachment = interaction.options.getAttachment('image');

        if (!attachment) {
            console.log('No image attachment found!');
            return interaction.reply('No image attachment found!');
        }

        try {
            await resetgifid();
            console.log("Reset command sent successfully");

            console.log('Loading image from URL:', attachment.url);

            const image = await loadImage(attachment.url);
            
            const canvas = createCanvas(64, 64);
            const ctx = canvas.getContext('2d');

            // Apply image smoothing for better scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high'; // Options: 'low', 'medium', 'high'

            // Optional: Adjust brightness and contrast
            ctx.filter = 'brightness(1.1) contrast(1.2)'; // Brighten and add contrast

            // Resize and draw the image on canvas
            ctx.drawImage(image, 0, 0, 64, 64); 

            // Optional: Apply dithering or grayscale
            // Uncomment whichever you want to apply, or both
            // applyDithering(canvas);
            // applyGrayscale(canvas);

            const base64 = getRGBBase64(canvas);
            console.log('Base64 RGB Image Data:', base64.substring(0, 100)); 

            // Store the base64 image data in the shared buffer
            imageBuffer.lastImage = base64;

            let picID = Date.now();

            const payload = JSON.stringify({
                Command: "Draw/SendHttpGif",
                PicNum: 1,
                PicWidth: 64,
                PicOffset: 0,
                PicID: picID,
                PicSpeed: 100,
                PicData: base64
            });

            const url = new URL(`http://${process.env.PIXOO_IP}:80/post`);
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };

            const req = http.request(url, options, res => {
                let responseData = '';

                res.on('data', chunk => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    console.log('Response status:', res.statusCode);
                    console.log('Response data:', responseData);

                    if (res.statusCode === 200) {
                        interaction.reply('Image processed and sent to Pixoo.');
                    } else {
                      interaction.reply(`Failed to send image to Pixoo. Status code: ${res.statusCode}`);

                    }
                });
            });

            req.on('error', error => {
                console.error('Error processing image:', error.message);
                interaction.reply('Failed to process the image.');
            });

            req.write(payload);
            req.end();

        } catch (error) {
            console.error('Error processing image:', error.message);
            await interaction.reply('Failed to process the image.');
        }
    },
};

