const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const imageBuffer = require('./imageBuffer'); // Import the shared image buffer

module.exports = {
    data: new SlashCommandBuilder()
        .setName('currentimage')
        .setDescription('Get the last image or GIF frame sent to the Pixoo device'),
    async execute(interaction) {
        // Check if there is an image stored in the buffer
        if (imageBuffer.lastImage) {
            console.log('Last image base64:', imageBuffer.lastImage.substring(0, 100)); // For debugging

            // Convert base64 back to buffer
            const imgBuffer = Buffer.from(imageBuffer.lastImage, 'base64');

            // Create a canvas to restore the image
            const canvas = createCanvas(256, 256); // Upscale to make it larger
            const ctx = canvas.getContext('2d');

            // Draw the image on the canvas
            const imageData = ctx.createImageData(64, 64);
            const data = imageData.data;
            let offset = 0;

            // Convert RGB data back into canvas format (from buffer to image data)
            for (let i = 0; i < data.length; i += 4) {
                data[i] = imgBuffer[offset++];     // Red
                data[i + 1] = imgBuffer[offset++]; // Green
                data[i + 2] = imgBuffer[offset++]; // Blue
                data[i + 3] = 255;                 // Alpha (opaque)
            }
            ctx.putImageData(imageData, 0, 0);

            // Scale up the image
            ctx.imageSmoothingEnabled = false; // Turn off smoothing for a blocky effect
            ctx.drawImage(canvas, 0, 0, 64, 64, 0, 0, 256, 256); // Draw the image scaled up

            // Save the image as a PNG file
            const outputPath = path.join(__dirname, 'lastImage.png');
            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            
            out.on('finish', async () => {
                console.log('PNG file created:', outputPath);

                // Create a Discord attachment from the file
                const attachment = new AttachmentBuilder(outputPath);

                // Reply with the image as an attachment
                await interaction.reply({ content: 'Here is the latest image or GIF frame sent to the Pixoo device:', files: [attachment] });
            });

        } else {
            // If no image is available in the buffer
            await interaction.reply('No image or GIF has been sent to the Pixoo device yet.');
        }
    },
};
