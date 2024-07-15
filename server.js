const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');
const app = express();
const PORT = 3000;

const logFile = fs.createWriteStream('app.log', { flags: 'a' });

const log = (message) => {
    const timestamp = new Date().toISOString();
    logFile.write(`[${timestamp}] ${message}\n`);
    console.log(message);
};

const botToken = '7338660402:AAG0YEtzZ2lPUcc2yx85VgyDUqq433-woJs';
const botUrl = `https://api.telegram.org/bot${botToken}`;

const botLink = `https://t.me/AnonymVersebot?start=`;
app.use(bodyParser.json());
app.use(express.static('public'));

const getUserData = () => {
    try {
        const data = fs.readFileSync('users.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        log(`Error reading user data: ${error.message}`);
        return [];
    }
};

const saveUserData = (data) => {
    try {
        fs.writeFileSync('users.json', JSON.stringify(data, null, 2));
        log('User data saved successfully');
    } catch (error) {
        log(`Error saving user data: ${error.message}`);
    }
};

const getTasks = () => {
    try {
        const data = fs.readFileSync('tasks.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        log(`Error reading tasks data: ${error.message}`);
        return [];
    }
};

const saveTasks = (data) => {
    try {
        fs.writeFileSync('tasks.json', JSON.stringify(data, null, 2));
        log('Tasks data saved successfully');
    } catch (error) {
        log(`Error saving tasks data: ${error.message}`);
    }
};

const calculateTotalReferrals = (users, userId) => {
    const user = users.find(u => u.telegramId === userId);
    if (!user) return 0;

    let totalReferrals = user.referrals.length;
    user.referrals.forEach(referralId => {
        totalReferrals += calculateTotalReferrals(users, referralId);
    });

    return totalReferrals;
};

const getRankInfo = (points) => {
    if (points >= 1000000) {
        return {
            rank: 'Anonymous',
            logo: 'public/pictures/anonymous.png',
            nextRank: { name: 'Max Rank', pointsNeeded: 0, logo: '' }
        };
    } else if (points >= 500000) {
        return {
            rank: 'Expert Hacker',
            logo: 'public/pictures/expert.png',
            nextRank: { name: 'Anonymous', pointsNeeded: 1000000 - points, logo: 'public/pictures/anonymous.png' }
        };
    } else if (points >= 100000) {
        return {
            rank: 'Advanced Hacker',
            logo: 'public/pictures/advanced.png',
            nextRank: { name: 'Expert Hacker', pointsNeeded: 500000 - points, logo: 'public/pictures/expert.png' }
        };
    } else if (points >= 50000) {
        return {
            rank: 'Basic Hacker',
            logo: 'public/pictures/basic.png',
            nextRank: { name: 'Advanced Hacker', pointsNeeded: 100000 - points, logo: 'public/pictures/advanced.png' }
        };
    } else if (points >= 10000) {
        return {
            rank: 'Amateur Hacker',
            logo: 'public/pictures/amateur.png',
            nextRank: { name: 'Basic Hacker', pointsNeeded: 50000 - points, logo: 'public/pictures/basic.png' }
        };
    } else {
        return {
            rank: 'Newbie Hacker',
            logo: 'public/pictures/newbie.png',
            nextRank: { name: 'Amateur Hacker', pointsNeeded: 10000 - points, logo: 'public/pictures/amateur.png' }
        };
    }
};

app.get('/user/:telegramId', async (req, res) => {
    const telegramId = req.params.telegramId;
    const referrerId = req.query.ref;
    const users = getUserData();

    log(`Kullanıcı ID: ${telegramId}, Referans ID: ${referrerId}`);

    if (telegramId === referrerId) {
        log(`User ${telegramId} attempted to refer themselves.`);
        return res.status(400).send('You cannot refer yourself.');
    }

    let user = users.find(u => u.telegramId === telegramId);
    if (!user) {
        user = { telegramId: telegramId, points: 0, lastClaimed: 0, nextClaim: 0, referrals: [], referredBy: referrerId };

        try {
            const response = await axios.get(`${botUrl}/getChat`, {
                params: { chat_id: telegramId }
            });
            if (response.data.ok) {
                const chat = response.data.result;
                user.username = `${chat.first_name || ''} ${chat.last_name || ''}`.trim();

                const photoResponse = await axios.get(`${botUrl}/getUserProfilePhotos`, {
                    params: { user_id: telegramId, limit: 1 }
                });
                if (photoResponse.data.ok && photoResponse.data.result.photos.length > 0) {
                    const photoFileId = photoResponse.data.result.photos[0][0].file_id;
                    const fileResponse = await axios.get(`${botUrl}/getFile`, {
                        params: { file_id: photoFileId }
                    });
                    if (fileResponse.data.ok) {
                        user.profilePhoto = `https://api.telegram.org/file/bot${botToken}/${fileResponse.data.result.file_path}`;
                    }
                }
            } else {
                log(`Telegram API error: ${response.data.description}`);
            }
        } catch (error) {
            log(`Error fetching user data from Telegram: ${error.message}`);
        }

        users.push(user);
        if (referrerId) {
            const referrer = users.find(u => u.telegramId === referrerId);
            if (referrer) {
                referrer.referrals.push(telegramId);
                log(`Referans kullanıcı ${referrerId}, ${telegramId} kullanıcısını referans etti.`);
                checkAndCompleteReferralTasks(referrer);
            } else {
                log(`Referans kullanıcı bulunamadı: ${referrerId}`);
            }
        }
        saveUserData(users);
    } else {
        log(`Kullanıcı zaten mevcut: ${JSON.stringify(user)}`);
    }

    const rankInfo = getRankInfo(user.points);
    const sortedUsers = users.sort((a, b) => b.points - a.points);
    const userRankPosition = sortedUsers.findIndex(u => u.telegramId === user.telegramId) + 1;

    res.json({
        ...user,
        rank: rankInfo.rank,
        rankLogo: rankInfo.logo,
        rankPosition: userRankPosition,
        nextRank: {
            name: rankInfo.nextRank.name,
            pointsNeeded: rankInfo.nextRank.pointsNeeded - user.points,
            logo: rankInfo.nextRank.logo
        }
    });
});

const checkAndCompleteReferralTasks = (user) => {
    const tasks = getTasks();
    let tasksUpdated = false;

    tasks.forEach(task => {
        if (task.type === 'referral') {
            if (!task.completedBy) {
                task.completedBy = [];
            }
            if (!task.completedBy.includes(user.telegramId) && user.referrals.length >= task.requiredReferrals) {
                user.points += task.points;
                task.completedBy.push(user.telegramId);
                tasksUpdated = true;
                log(`Kullanıcı ${user.telegramId} ${task.title} görevini tamamladı ve ${task.points} puan kazandı.`);
            }
        }
    });

    if (tasksUpdated) {
        saveTasks(tasks);
        saveUserData(getUserData().map(u => u.telegramId === user.telegramId ? user : u));
    }
};

app.post('/claim/:telegramId', (req, res) => {
    const telegramId = req.params.telegramId;
    const users = getUserData();
    const userIndex = users.findIndex(u => u.telegramId === telegramId);

    if (userIndex !== -1) {
        const user = users[userIndex];
        const now = new Date().getTime();

        if (now >= user.nextClaim) {
            user.points += 500;

            log(`Kullanıcı ${telegramId} puan talep etti. Yeni puan: ${user.points}`);

            const distributeReferralPoints = (userId, percentage) => {
                const referrer = users.find(u => u.telegramId === userId);
                if (referrer) {
                    const pointsEarned = 500 * percentage;
                    referrer.points += pointsEarned;
                    if (!referrer.referralPoints) referrer.referralPoints = 0;
                    referrer.referralPoints += pointsEarned;
                    log(`Referans kullanıcı ${referrer.telegramId}, ${telegramId} kullanıcısından ${pointsEarned} puan kazandı.`);
                } else {
                    log(`Referans kullanıcı bulunamadı: ${userId}`);
                }
            };

            let referrer = users.find(u => u.telegramId === user.referredBy);
            if (referrer) {
                distributeReferralPoints(referrer.telegramId, 0.1);
                if (referrer.referredBy) {
                    let referrer2 = users.find(u => u.telegramId === referrer.referredBy);
                    if (referrer2) {
                        distributeReferralPoints(referrer2.telegramId, 0.05);
                        if (referrer2.referredBy) {
                            let referrer3 = users.find(u => u.telegramId === referrer2.referredBy);
                            if (referrer3) {
                                distributeReferralPoints(referrer3.telegramId, 0.025);
                            }
                        }
                    }
                }
            }

            user.lastClaimed = now;
            user.nextClaim = now + 8 * 60 * 60 * 1000;
            users[userIndex] = user;
            saveUserData(users);
            res.json(user);
        } else {
            res.status(400).send('Claim not available yet');
        }
    } else {
        res.status(404).send('User not found');
    }
});

app.get('/referrals/:telegramId', (req, res) => {
    const telegramId = req.params.telegramId;
    const users = getUserData();

    const user = users.find(u => u.telegramId === telegramId);
    if (!user) {
        return res.status(404).send('User not found');
    }

    const referralDetails = user.referrals.map(refId => {
        const refUser = users.find(u => u.telegramId === refId);
        return {
            telegramId: refId,
            username: refUser ? refUser.username : 'Unknown',
            points: refUser ? refUser.points : 0,
            profilePhoto: refUser ? refUser.profilePhoto : '',
            referralCount: refUser ? calculateTotalReferrals(users, refId) : 0
        };
    });

    res.json({
        referralPoints: user.referralPoints || 0,
        referralDetails,
        totalReferrals: calculateTotalReferrals(users, telegramId)
    });
});

app.get('/tasks/:telegramId', (req, res) => {
    const telegramId = req.params.telegramId;
    const tasks = getTasks();
    const userTasks = tasks.map(task => {
        const userTask = { ...task };
        userTask.completed = task.completedBy && task.completedBy.includes(telegramId);
        return userTask;
    });
    res.json(userTasks);
});

app.post('/complete-task/:telegramId/:taskId', async (req, res) => {
    const telegramId = req.params.telegramId;
    const taskId = req.params.taskId;

    const users = getUserData();
    const tasks = getTasks();

    const user = users.find(u => u.telegramId === telegramId);
    if (!user) {
        return res.status(404).send('User not found');
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        return res.status(404).send('Task not found');
    }

    if (!task.completedBy) {
        task.completedBy = [];
    }

    if (task.type === 'telegram-check') {
        try {
            const checkUrl = task.checkUrl.replace('<user_id>', telegramId).replace('<bot_token>', botToken);
            const response = await axios.get(checkUrl);
            log(`Telegram API yanıtı: ${JSON.stringify(response.data)}`);

            if (response.data.ok && (response.data.result.status === 'member' || response.data.result.status === 'administrator' || response.data.result.status === 'creator')) {
                user.points += task.points;
                task.completedBy.push(telegramId);
                saveUserData(users);
                saveTasks(tasks);
                return res.json({ success: true, newPoints: user.points, points: task.points });
            } else {
                return res.json({ success: false, message: `You have to join ${task.title.split(' ')[1]} first` });
            }
        } catch (error) {
            log(`Error checking task completion for user ${telegramId}: ${error.message}`);
            return res.json({ success: false, message: `Error checking task completion: ${error.message}` });
        }
    } else if (!task.completedBy.includes(telegramId)) {
        user.points += task.points;
        task.completedBy.push(telegramId);
        saveUserData(users);
        saveTasks(tasks);
        res.json({ success: true, newPoints: user.points, points: task.points });
    } else {
        res.json({ success: false });
    }
});

app.post('/invite/:telegramId', async (req, res) => {
    const telegramId = req.params.telegramId;
    const referralLink = `${botLink}${telegramId}`;
    log(`Generated referral link: ${referralLink}`);
    const message = `Invite your friends using this link: \n\n\`${referralLink}\`\n\nYou will earn points from their activities\\!`;

    try {
        await axios.post(`${botUrl}/sendMessage`, {
            chat_id: telegramId,
            text: message,
            parse_mode: 'MarkdownV2'
        });
        log(`Davet linki ${telegramId} kullanıcısına gönderildi.`);
        res.send('Referral link sent');
    } catch (error) {
        log(`Davet linki gönderilirken hata oluştu: ${error.message}`);
        res.status(500).send('Error sending referral link');
    }
});

app.get('/all-users', (req, res) => {
    const users = getUserData();
    res.json(users);
});

app.listen(PORT, () => {
    log(`Server is running on http://localhost:${PORT}`);
});
