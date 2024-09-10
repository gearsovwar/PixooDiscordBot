const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');
const GIF = require('@fand/gifuct-js');
const sharp = require('sharp'); // Import sharp for resizing
const imageBuffer = require('./imageBuffer'); // Import the shared image buffer

async function fetchAndDecodeGif(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch GIF: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new GIF(new Uint8Array(arrayBuffer));
}

async function processGif(url) {
    try {
        const gif = await fetchAndDecodeGif(url);
        const frames = await gif.decompressFrames(true);

        if (!frames.length) {
            throw new Error('No frames found in the GIF');
        }

        console.log(`Decoded ${frames.length} frames from GIF`);
        return frames;
    } catch (error) {
        console.error('Error processing GIF:', error.message);
        throw error;
    }
}

function getRGBBase64(buffer) {
    const rgbBuffer = Buffer.alloc(buffer.length / 4 * 3); // RGB format instead of RGBA
    let rgbOffset = 0;

    for (let i = 0; i < buffer.length; i += 4) {
        rgbBuffer[rgbOffset++] = buffer[i];     // Red
        rgbBuffer[rgbOffset++] = buffer[i + 1]; // Green
        rgbBuffer[rgbOffset++] = buffer[i + 2]; // Blue
    }

    return rgbBuffer.toString('base64');
}

async function resizeFrameTo64x64(frame) {
    const { dims, patch } = frame;

    // Convert frame data (patch) to raw image buffer
    const rawImageBuffer = Buffer.from(patch);

    // Use sharp to process the image
    const resizedBuffer = await sharp(rawImageBuffer, {
        raw: {
            width: dims.width,
            height: dims.height,
            channels: 4, // Assuming GIF uses RGBA
        },
    })
    .resize(64, 64) // Resize to 64x64
    .toFormat('png') // Convert to PNG format
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // Remove transparency by adding white background
    .toBuffer();

    return resizedBuffer;
}


// Call this function only before the first GIF session or when resetting is required
async function sendResetCommand() {
    const pixooUrl = `http://${process.env.PIXOO_IP}:80/post`;

    const payload = {
        Command: 'Draw/ResetHttpGifId',
    };

    // Log the payload before sending it
    console.log('Sending reset command with payload:', JSON.stringify(payload, null, 2));

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    };

    try {
        const res = await fetch(pixooUrl, options);
        const responseText = await res.text(); // Get the response body as text

        console.log(`Response Status: ${res.status}`);
        console.log(`Response Text: ${responseText}`);

        if (res.ok) {
            console.log('Reset command sent to Pixoo');
        } else {
            console.error(`Failed to send reset command to Pixoo. Status code: ${res.status}`);
        }
    } catch (err) {
        console.error(`Error sending reset command to Pixoo: ${err.message}`);
    }
}

async function sendGifToPixoo(frames, picID, picSpeed) {
    const pixooUrl = `http://${process.env.PIXOO_IP}:80/post`;

    // First, send the reset command if needed (you can skip this if not needed)
    const resetPayload = { Command: "Draw/ResetHttpGifId" };
    try {
        console.log('Sending reset command with payload:', JSON.stringify(resetPayload, null, 2));
        const resetRes = await fetch(pixooUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resetPayload),
        });
        if (!resetRes.ok) throw new Error(`Failed to reset: ${resetRes.status}`);
        console.log('Reset command successful');
    } catch (err) {
        console.error(`Error sending reset command to Pixoo: ${err.message}`);
        return; // Stop if the reset command fails
    }

    // Now process and send the first 60 frames
    for (let i = 0; i < Math.min(frames.length, 60); i++) {
        try {
            // Extract the frame pixel data (already Uint8ClampedArray)
            const frameData = frames[i].patch; // This is Uint8ClampedArray of pixel data
            const frameDims = frames[i].dims;

            // Resize the frame to 64x64 using sharp
            const resizedFrame = await sharp(Buffer.from(frameData), {
                raw: {
                    width: frameDims.width,
                    height: frameDims.height,
                    channels: 4 // Assuming RGBA, adjust if needed
                }
            })
            .resize(64, 64) // Resize to 64x64
            .raw()
            .toBuffer(); // Get raw pixel data as buffer

            // Convert the resized frame to RGB base64 format
            const rgbBase64 = getRGBBase64(resizedFrame);

            // Prepare the payload for the frame
            const payload = {
                Command: 'Draw/SendHttpGif',
                PicNum: Math.min(frames.length, 60), // Total number of frames sent
                PicWidth: 64,
                PicOffset: i,
                PicID: picID,
                PicSpeed: picSpeed,
                PicData: rgbBase64, // base64-encoded RGB frame data
            };

            // Log the JSON payload
            console.log(`Sending frame ${i}:`);
            console.log('JSON payload:', JSON.stringify(payload, null, 2));

            // Send the frame to the Pixoo device
            const res = await fetch(pixooUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseText = await res.text();
            console.log(`Response Status: ${res.status}`);
            console.log(`Response Text: ${responseText}`);

            if (res.ok) {
                console.log(`Frame ${i} sent successfully.`);
            } else {
                console.error(`Failed to send frame ${i}. Status code: ${res.status}`);
            }
        } catch (err) {
            console.error(`Error processing frame ${i}: ${err.message}`);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Send a GIF to the Pixoo device')
        .addAttachmentOption(option =>
            option.setName('gif')
                .setDescription('The GIF to process')
                .setRequired(true)),
    async execute(interaction) {
        const attachment = interaction.options.getAttachment('gif');

        if (!attachment) {
            console.log('No GIF attachment found!');
            return interaction.reply('No GIF attachment found!');
        }

        try {
            // Defer the reply, letting Discord know you'll respond later
            await interaction.deferReply();

            // Retrieve and process the GIF
            console.log('Retrieved GIF URL:', attachment.url);
            const frames = await processGif(attachment.url);

            // Initialize picID and speed
            let picID = Math.floor(Math.random() * 10000); // Unique ID for this animation
            const picSpeed = 100; // Example speed in ms

            // Send reset command
            await sendResetCommand();

            // Send the GIF to Pixoo
            await sendGifToPixoo(frames, picID, picSpeed);

            // After processing, send the final response
            await interaction.editReply('GIF processing and sending completed.');
        } catch (error) {
            console.error('Error processing GIF:', error.message);
            await interaction.editReply('Failed to process the GIF.');
        }
    },
};
