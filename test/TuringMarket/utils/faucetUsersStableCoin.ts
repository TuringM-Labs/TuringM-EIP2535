const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
export const faucetUsersStableCoin = async amount => {
    const contract = await getContractWithSignerKey('USDTMock', 'deployer');
    const users = await getUnnamedAccounts();
    for (let i = 0; i < 10; i++) {
        const user = users[i];
        const tx = await contract.mint(user, parseUnits(amount + '', 6));
        await tx.wait();
        const balance = await contract.balanceOf(user);
        theDebug(`StableCoinMock users[${i}] ${user} balance`, formatUnits(balance, 6));
    }
}