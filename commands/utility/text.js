const { SlashCommandBuilder } = require('discord.js');
const { createCanvas, registerFont } = require('canvas');
const http = require('http');
const { URL } = require('url');
const path = require('path');
const imageBuffer = require('./imageBuffer'); // Import the shared image buffer

// Register a custom pixel font
registerFont(path.resolve(__dirname, 'C:/Users/johnm/Pictures/pixel2.ttf'), { family: 'PixelFont' });

// Function to get Base64 RGB from canvas
function getRGBBase64(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    let rgbBuffer = Buffer.alloc(canvas.width * canvas.height * 3);
    let offset = 0;

    for (let i = 0; i < data.length; i += 4) {
        rgbBuffer.writeUInt8(data[i], offset++);     // Red
        rgbBuffer.writeUInt8(data[i + 1], offset++); // Green
        rgbBuffer.writeUInt8(data[i + 2], offset++); // Blue
    }

    return rgbBuffer.toString('base64'); 
}

// Function to reset GIF ID
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

// Function to draw text on canvas using a pixel font
function drawTextOnCanvas(text) {
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext('2d');

    // Clear the canvas with a black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set font properties
    ctx.fillStyle = 'white';
    ctx.font = '10px "PixelFont"'; // Adjust font size and family to match your pixel font

    // Function to wrap text
    function wrapText(text, maxWidth) {
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxWidth) {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    const maxWidth = canvas.width;
    const lines = wrapText(text, maxWidth);

    let xOffset = 0;
    let yOffset = 0;
    const lineHeight = 10; // Adjust based on your font size

    lines.forEach(line => {
        ctx.fillText(line, xOffset, yOffset + lineHeight);
        yOffset += lineHeight; // Move to the next line
    });

    // Convert image to pure black and white
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const color = gray < 128 ? 0 : 255; // Threshold to convert gray to black or white
        data[i] = color;       // Red
        data[i + 1] = color;   // Green
        data[i + 2] = color;   // Blue
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('text')
        .setDescription('Send custom text to the Pixoo display')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The text to display')
                .setRequired(true)),
    async execute(interaction) {
        const message = interaction.options.getString('message');

        if (!message) {
            console.log('No text input found!');
            return interaction.reply('No text input found!');
        }

        try {
            await resetgifid();
            console.log("Reset command sent successfully");

            console.log('Drawing text onto canvas:', message);

            // Draw text on canvas
            const canvas = drawTextOnCanvas(message);

            // Convert the canvas to base64 RGB data
            const base64 = getRGBBase64(canvas);
            console.log('Base64 RGB Text Data:', base64.substring(0, 100)); 

            let picID = Date.now();

            // Store the image in the shared buffer
            imageBuffer.lastImage = base64;

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
                        interaction.reply('Text processed and sent to Pixoo.');
                    } else {
                        interaction.reply(`Failed to send text to Pixoo. Status code: ${res.statusCode}`);
                    }
                });
            });

            req.on('error', error => {
                console.error('Error processing text:', error.message);
                interaction.reply('Failed to process the text.');
            });

            req.write(payload);
            req.end();

        } catch (error) {
            console.error('Error processing text:', error.message);
            await interaction.reply('Failed to process the text.');
        }
    },
};
