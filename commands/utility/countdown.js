const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');

async function setTimer(minutes, seconds) {
    const pixooUrl = `http://${process.env.PIXOO_IP}:80/post`;

    const payload = {
        Command: 'Tools/SetTimer',
        Minute: minutes,
        Second: seconds,
        Status: 1 // Start the timer
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    };

    try {
        const res = await fetch(pixooUrl, options);
        const responseText = await res.text();

        console.log(`Response Status: ${res.status}`);
        console.log(`Response Text: ${responseText}`);

        if (res.ok) {
            console.log('Timer set successfully on Pixoo');
        } else {
            console.error(`Failed to set timer on Pixoo. Status code: ${res.status}`);
        }
    } catch (err) {
        console.error(`Error setting timer on Pixoo: ${err.message}`);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('countdown')
        .setDescription('Set a countdown timer on the Pixoo device')
        .addIntegerOption(option => 
            option.setName('minutes')
                .setDescription('Minutes for the countdown')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('seconds')
                .setDescription('Seconds for the countdown')
                .setRequired(true)),
    async execute(interaction) {
        const minutes = interaction.options.getInteger('minutes');
        const seconds = interaction.options.getInteger('seconds');

        if (minutes < 0 || seconds < 0 || seconds > 59) {
            return interaction.reply('Invalid time input. Please enter valid minutes and seconds.');
        }

        await interaction.deferReply();

        try {
            await setTimer(minutes, seconds);
            await interaction.editReply(`Timer set for ${minutes} minutes and ${seconds} seconds.`);
        } catch (error) {
            console.error('Error setting timer:', error.message);
            await interaction.editReply('Failed to set the timer.');
        }
    },
};
