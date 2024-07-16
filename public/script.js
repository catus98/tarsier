document.addEventListener('DOMContentLoaded', () => {
    const telegram = window.Telegram.WebApp;
    const userId = telegram.initDataUnsafe.user.id;
    const userName = telegram.initDataUnsafe.user.first_name;

    document.getElementById('username').innerText = `Hi, ${userName}`;

    const urlParams = new URLSearchParams(window.location.search);
    const referrerId = urlParams.get('ref') || '';

    console.log(`Referrer ID: ${referrerId}`);

    fetch(`/user/${userId}?ref=${referrerId}`)
        .then(response => response.json())
        .then(user => {
            document.getElementById('points').innerText = formatNumber(user.points);
            updateTimer(user.nextClaim);
            updateRankInfo(user);
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
        });

    fetch(`/referrals/${userId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('earned-points').innerText = formatNumber(data.referralPoints);
            const referralList = document.getElementById('referral-list');
            referralList.innerHTML = '';

            document.getElementById('friends-count').innerText = `${data.referralDetails.length} Friends`;
            document.getElementById('referrals-count').innerText = `${data.totalReferrals} Referrals`;

            data.referralDetails.forEach(ref => {
                const listItem = document.createElement('div');
                listItem.className = 'referral-item';

                const profileImage = document.createElement('img');
                profileImage.src = ref.profilePhoto || 'default-profile.png';
                profileImage.alt = ref.username;
                profileImage.className = 'profile-photo';

                const username = document.createElement('span');
                username.innerText = ref.username;

                const points = document.createElement('span');
                points.innerText = formatNumber(ref.points);

                listItem.appendChild(profileImage);
                listItem.appendChild(username);
                listItem.appendChild(points);
                referralList.appendChild(listItem);
            });
        })
        .catch(error => {
            console.error('Error fetching referral data:', error);
        });

    fetch(`/tasks/${userId}`)
        .then(response => response.json())
        .then(tasks => {
            const taskList = document.getElementById('task-list');
            taskList.innerHTML = '';

            tasks.forEach(task => {
                const listItem = document.createElement('div');
                listItem.className = 'task-item' + (task.completed ? ' completed' : '');

                const taskIconContainer = document.createElement('div');
                taskIconContainer.className = 'task-icon-container';

                if (task.title.toLowerCase().includes('twitter')) {
                    const taskIcon = document.createElement('img');
                    taskIcon.src = 'pictures/twitter.png';
                    taskIcon.alt = 'Twitter Logo';
                    taskIcon.className = 'task-logo';
                    taskIconContainer.appendChild(taskIcon);
                } else if (task.title.toLowerCase().includes('telegram') || task.title.toLowerCase().includes('chat')) {
                    const taskIcon = document.createElement('img');
                    taskIcon.src = 'pictures/telegram.png';
                    taskIcon.alt = 'Telegram Logo';
                    taskIcon.className = 'task-logo';
                    taskIconContainer.appendChild(taskIcon);
                } else {
                    const taskIcon = document.createElement('i');
                    taskIcon.className = 'si si-user task-icon';
                    taskIconContainer.appendChild(taskIcon);

                    if (task.type === 'referral') {
                        const taskIconOverlay = document.createElement('span');
                        taskIconOverlay.className = 'task-icon-overlay';
                        taskIconOverlay.innerText = task.requiredReferrals;
                        taskIconContainer.appendChild(taskIconOverlay);
                    }
                }

                const taskTitle = document.createElement('span');
                taskTitle.innerText = task.title;
                taskTitle.className = 'task-title';

                const taskPoints = document.createElement('span');
                taskPoints.innerText = task.completed ? `Received +${formatNumber(task.points)}` : `+${formatNumber(task.points)}`;
                taskPoints.className = 'task-points';

                listItem.appendChild(taskIconContainer);
                listItem.appendChild(taskTitle);
                listItem.appendChild(taskPoints);

                if (task.type !== 'referral' && task.type !== 'telegram-check') {
                    const taskAction = document.createElement('a');
                    taskAction.innerText = task.completed ? '>' : 'Perform >';
                    taskAction.href = task.link;
                    taskAction.target = '_blank';
                    taskAction.className = 'perform-btn';
                    taskAction.addEventListener('click', (e) => {
                        if (!task.completed) {
                            if (!taskAction.classList.contains('countdown-active')) {
                                taskAction.classList.add('countdown-active');
                                startCountdown(task.id, listItem, taskAction, task.link);
                            }
                        }
                    });
                    listItem.appendChild(taskAction);
                }

                if (task.type === 'telegram-check') {
                    const taskAction = document.createElement('a');
                    taskAction.innerText = task.completed ? '>' : 'Join >';
                    taskAction.href = task.link;
                    taskAction.target = '_blank';
                    taskAction.className = 'perform-btn';
                    taskAction.addEventListener('click', (e) => {
                        if (!task.completed) {
                            if (!taskAction.classList.contains('countdown-active')) {
                                taskAction.classList.add('countdown-active');
                                startTelegramCheck(task.id, listItem, taskAction, task.link);
                            }
                        }
                    });
                    listItem.appendChild(taskAction);
                }

                taskList.appendChild(listItem);
            });
        })
        .catch(error => {
            console.error('Error fetching tasks:', error);
        });

    function startCountdown(taskId, taskItem, taskAction, taskLink) {
        const countdownOverlay = document.createElement('div');
        countdownOverlay.className = 'countdown-overlay';
        countdownOverlay.innerHTML = `<i class="si si-clock"></i><span id="countdown-timer-${taskId}">10</span>`;

        taskItem.appendChild(countdownOverlay);

        let countdown = 10;
        const countdownInterval = setInterval(() => {
            countdown--;
            document.getElementById(`countdown-timer-${taskId}`).innerText = countdown;
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                completeTask(taskId, taskItem, taskAction, countdownOverlay);
            }
        }, 1000);

        window.open(taskLink, '_blank');
    }

    function startTelegramCheck(taskId, taskItem, taskAction, taskLink) {
        const countdownOverlay = document.createElement('div');
        countdownOverlay.className = 'countdown-overlay';
        countdownOverlay.innerHTML = `<i class="si si-clock"></i><span id="countdown-timer-${taskId}">10</span>`;

        taskItem.appendChild(countdownOverlay);

        let countdown = 10;
        const countdownInterval = setInterval(() => {
            countdown--;
            document.getElementById(`countdown-timer-${taskId}`).innerText = countdown;
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                completeTask(taskId, taskItem, taskAction, countdownOverlay, true);
            }
        }, 1000);

        window.open(taskLink, '_blank');
    }

    function completeTask(taskId, taskItem, taskAction, countdownOverlay, isTelegramCheck = false) {
        fetch(`/complete-task/${userId}/${taskId}`, { method: 'POST' })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    document.getElementById('points').innerText = formatNumber(result.newPoints);
                    alert(`Task completed! You received ${formatNumber(result.points)} points.`);
                    if (countdownOverlay) {
                        taskItem.removeChild(countdownOverlay);
                    }
                    taskItem.classList.add('completed');
                    taskItem.querySelector('.task-points').innerText = `Received +${formatNumber(result.points)}`;
                    taskAction.innerText = '>';
                    taskAction.classList.add('completed');
                    taskAction.href = taskAction.href;
                    setTimeout(() => {
                        location.reload(); // Sayfa otomatik yenilenecek
                    }, 1000);
                } else {
                    alert(result.message || 'Error completing task.');
                    if (isTelegramCheck) {
                        taskAction.classList.remove('countdown-active');
                    }
                }
            })
            .catch(error => {
                console.error('Error completing task:', error);
                if (countdownOverlay) {
                    taskItem.removeChild(countdownOverlay);
                }
                taskAction.classList.remove('countdown-active');
            });
    }

    function updateTimer(nextClaimTime) {
        const timerElement = document.getElementById('claim-timer');
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = nextClaimTime - now;

            if (distance <= 0) {
                clearInterval(interval);
                timerElement.innerHTML = '<button class="claim-btn" onclick="claimPoints()">Collect +500 Points <i class="si si-gift"></i></button>';
            } else {
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                timerElement.innerHTML = `Get after: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} <span class="clock"><i class="si si-clock"></i></span>`;
                timerElement.className = 'timer-collected';
            }
        }, 1000);
    }

    function updateRankInfo(user) {
        fetch(`/all-users`)
            .then(response => response.json())
            .then(users => {
                const rankInfo = getRankInfo(user.points);
                const sortedUsers = users.sort((a, b) => b.points - a.points);
                const rankPosition = sortedUsers.findIndex(u => u.telegramId === user.telegramId) + 1;

                document.getElementById('rank-logo').src = rankInfo.logo;
                document.getElementById('rank-name').innerText = rankInfo.rank;
                document.getElementById('rank-position').innerText = `#${rankPosition}`;

                if (rankInfo.rank !== 'Anonymous') {
                    document.getElementById('next-rank-info').innerHTML = `+${rankInfo.nextRank.pointsNeeded - user.points} left for ${rankInfo.nextRank.name}
                    <img src="${rankInfo.nextRank.logo}" alt="Next Rank Logo" class="next-rank-logo">`;
                    document.getElementById('next-rank-info').style.display = 'flex';
                } else {
                    document.getElementById('next-rank-info').style.display = 'none';
                }

                if (rankInfo.rank === 'Anonymous') {
                    document.querySelector('.rank-container').classList.add('anonymous-rank');
                } else {
                    document.querySelector('.rank-container').classList.remove('anonymous-rank');
                }
            })
            .catch(error => {
                console.error('Error fetching all users data:', error);
            });
    }

    function getRankInfo(points) {
        if (points >= 1000000) {
            return {
                rank: 'Anonymous',
                logo: 'pictures/anonymous.png',
                nextRank: { name: 'Max Rank', pointsNeeded: 0, logo: '' }
            };
        } else if (points >= 500000) {
            return {
                rank: 'Expert Hacker',
                logo: 'pictures/expert.png',
                nextRank: { name: 'Anonymous', pointsNeeded: 1000000 - points, logo: 'pictures/anonymous.png' }
            };
        } else if (points >= 100000) {
            return {
                rank: 'Advanced Hacker',
                logo: 'pictures/advanced.png',
                nextRank: { name: 'Expert Hacker', pointsNeeded: 500000 - points, logo: 'pictures/expert.png' }
            };
        } else if (points >= 50000) {
            return {
                rank: 'Basic Hacker',
                logo: 'pictures/basic.png',
                nextRank: { name: 'Advanced Hacker', pointsNeeded: 100000 - points, logo: 'pictures/advanced.png' }
            };
        } else if (points >= 10000) {
            return {
                rank: 'Amateur Hacker',
                logo: 'pictures/amateur.png',
                nextRank: { name: 'Basic Hacker', pointsNeeded: 50000 - points, logo: 'pictures/basic.png' }
            };
        } else {
            return {
                rank: 'Newbie Hacker',
                logo: 'pictures/newbie.png',
                nextRank: { name: 'Amateur Hacker', pointsNeeded: 10000 - points, logo: 'pictures/amateur.png' }
            };
        }
    }

    window.claimPoints = () => {
        fetch(`/claim/${userId}`, { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('Claim not available yet');
                }
            })
            .then(user => {
                document.getElementById('points').innerText = formatNumber(user.points);
                updateTimer(user.nextClaim);
            })
            .catch(error => {
                alert(error.message);
            });
    };

    document.querySelector('.invite-btn').addEventListener('click', () => {
        const referralLink = `https://t.me/AnonymVersebot?start=${userId}`;

        navigator.clipboard.writeText(referralLink).then(() => {
            fetch(`/invite/${userId}`, { method: 'POST' })
                .then(response => response.text())
                .then(message => {
                    alert('Referral link copied and sent to you.');
                })
                .catch(error => {
                    alert('Error sending invite link');
                });
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    });

    const spaceBtn = document.getElementById('space-btn');
    const taskBtn = document.getElementById('task-btn');
    const inviteBtn = document.getElementById('invite-btn');
    const walletBtn = document.getElementById('wallet-btn');

    spaceBtn.addEventListener('click', () => {
        setActiveButton(spaceBtn);
        showSection('space');
    });

    taskBtn.addEventListener('click', () => {
        setActiveButton(taskBtn);
        showSection('task');
    });

    inviteBtn.addEventListener('click', () => {
        setActiveButton(inviteBtn);
        showSection('invite');
    });

    walletBtn.addEventListener('click', () => {
        setActiveButton(walletBtn);
        showSection('wallet');
    });

    function setActiveButton(activeButton) {
        const buttons = [spaceBtn, taskBtn, inviteBtn, walletBtn];
        buttons.forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
    }

    function showSection(section) {
        document.getElementById('space-section').style.display = 'none';
        document.getElementById('invite-section').style.display = 'none';
        document.getElementById('task-section').style.display = 'none';
        document.getElementById('wallet-section').style.display = 'none';

        if (section === 'space') {
            document.getElementById('space-section').style.display = 'block';
        } else if (section === 'task') {
            document.getElementById('task-section').style.display = 'block';
        } else if (section === 'invite') {
            document.getElementById('invite-section').style.display = 'block';
        } else if (section === 'wallet') {
            document.getElementById('wallet-section').style.display = 'block';
        }
    }

    setActiveButton(spaceBtn);
    showSection('space');
});

function formatNumber(num) {
    return num.toLocaleString();
}
