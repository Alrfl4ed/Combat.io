const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const players = {};
const bullets = [];

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id,
        x: (Math.random() - 0.5) * 40,
        y: 1.8,
        z: (Math.random() - 0.5) * 40,
        yaw: 0,
        health: 100,
        score: 0
    };

    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('playerJoined', players[socket.id]);

    socket.on('playerInput', (data) => {
        const p = players[socket.id];
        if (!p || p.health <= 0) return;
        p.x = data.x;
        p.y = data.y;
        p.z = data.z;
        p.yaw = data.yaw;
        socket.broadcast.emit('playerMoved', { id: socket.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw });
    });

    socket.on('shoot', (data) => {
        const p = players[socket.id];
        if (!p || p.health <= 0) return;

        const bullet = {
            id: Math.random().toString(36).substr(2, 9),
            ownerId: socket.id,
            x: data.x,
            y: data.y,
            z: data.z,
            dirX: data.dirX,
            dirY: data.dirY,
            dirZ: data.dirZ,
            damage: data.damage,
            isExplosive: data.isExplosive,
            speed: data.speed,
            life: 120
        };
        bullets.push(bullet);
        io.emit('bulletSpawned', bullet);
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

setInterval(() => {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.dirX * b.speed;
        b.y += b.dirY * b.speed;
        b.z += b.dirZ * b.speed;
        b.life--;

        for (let id in players) {
            const p = players[id];
            if (id !== b.ownerId && p.health > 0) {
                const dist = Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z);
                if (dist < 1.2) {
                    p.health -= b.damage;
                    if (p.health <= 0 && players[b.ownerId]) {
                        players[b.ownerId].score += 1;
                    }
                    io.emit('playerDamaged', { id: id, health: p.health, attackerId: b.ownerId });
                    if (p.health <= 0) {
                        setTimeout(() => {
                            if (players[id]) {
                                players[id].health = 100;
                                players[id].x = (Math.random() - 0.5) * 40;
                                players[id].z = (Math.random() - 0.5) * 40;
                                io.emit('playerRespawned', players[id]);
                            }
                        }, 3000);
                    }
                    bullets.splice(i, 1);
                    break;
                }
            }
        }
        if (b && b.life <= 0) bullets.splice(i, 1);
    }
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
