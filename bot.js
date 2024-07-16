const { Telegraf, Markup } = require('telegraf');

const botToken = '7338660402:AAG0YEtzZ2lPUcc2yx85VgyDUqq433-woJs';
const bot = new Telegraf(botToken);

const webAppUrl = 'https://www.anonymverse.xyz';

bot.start((ctx) => {
    const referrerId = ctx.message.text.split(' ')[1] || '';
    const referralUrl = `${webAppUrl}?ref=${referrerId}`;

    const welcomeMessage = `
Welcome to AnonymVerse!

Participate in our airdrops, collect points, and claim your own land in this boundless universe. Here, your potential is limitless.

Join our communities to stay updated and connect with fellow adventurers:
    `;

    ctx.replyWithPhoto(
        'AgACAgIAAyEGAASBw7WoAAMDZpDlFapgZthugKt70C3TVrBhNm0AAl_cMRumu4lIJRn8npjzHWgBAAMCAAN5AAM1BA',
        {
            caption: welcomeMessage,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Open Web App', web_app: { url: referralUrl } }],
                    [{ text: 'Join Our Communities', callback_data: 'show_communities' }]
                ]
            }
        }
    );
});

bot.action('show_communities', (ctx) => {
    ctx.editMessageCaption('Our Communities:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Telegram Channel', url: 'https://t.me/anonymverse' }],
                [{ text: 'Telegram Chat', url: 'https://t.me/anonymversechat' }],
                [{ text: 'Twitter', url: 'https://twitter.com/anonymverse' }]
            ]
        }
    });
});

bot.command('invite', (ctx) => {
    const telegramId = ctx.message.from.id;
    const referralLink = `https://t.me/AnonymVersebot?start=${telegramId}`;
    const message = `Invite your friends using this link: \n\n\`${referralLink}\`\n\nYou will earn points from their activities!`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.launch();
