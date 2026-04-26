const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ВАШ КЛЮЧ GIGACHAT
const GIGACHAT_CREDENTIALS = "MDE5ZGNiMGMtYjU2OS03ODkwLWI2NWMtM2IzNjA1NzdiOGI1Ojk1MGFmZGQwLTY4MjktNDMzMy05YTEwLTEyY2IyZTM3NmQyMA==";

let accessToken = null;
let tokenExpiry = 0;

// Получение токена
async function getGigaToken() {
    try {
        const response = await axios.post(
            'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
            'scope=GIGACHAT_API_PERS',
            {
                headers: {
                    'Authorization': `Basic ${GIGACHAT_CREDENTIALS}`,
                    'RqUID': require('crypto').randomUUID(),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_at || 3600) * 1000;
        console.log('✅ Токен GigaChat получен');
        return accessToken;
    } catch (error) {
        console.error('❌ Ошибка получения токена:', error.response?.data || error.message);
        return null;
    }
}

// Запрос к GigaChat
async function askGigaChat(question) {
    if (!accessToken || Date.now() >= tokenExpiry) {
        await getGigaToken();
    }
    
    if (!accessToken) {
        return "❌ Ошибка авторизации GigaChat";
    }
    
    try {
        const response = await axios.post(
            'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
            {
                model: "GigaChat",
                messages: [
                    { role: "system", content: "Ты - RAI, дружелюбный ИИ-ассистент. Отвечай по-русски, кратко и полезно." },
                    { role: "user", content: question }
                ],
                temperature: 0.7,
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('❌ GigaChat ошибка:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            accessToken = null;
            return "🔑 Требуется обновление токена";
        }
        
        return "🤔 Извините, произошла ошибка при обращении к GigaChat";
    }
}

// API endpoint для мессенджера
app.post('/ask', async (req, res) => {
    const { question } = req.body;
    
    if (!question) {
        return res.status(400).json({ error: 'No question provided' });
    }
    
    const answer = await askGigaChat(question);
    res.json({ answer });
});

// Проверка работы сервера
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'RAI proxy server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 RAI proxy server running on port ${PORT}`);
});