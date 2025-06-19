const scope = getNameForTag(__dirname, __filename, 3)
const theDebug = require('debug')(`test:${scope}`)
export const faucetUsersStableCoin = async amount => {
    const contract = await getContractWithSignerKey('USDTMock', 'deployer');
    const users = await getUnnamedAccounts();
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const tx = await contract.mint(user, ethers.utils.parseUnits(amount + '', 6));
        await tx.wait();
        // const balance = await contract.balanceOf(user);
        // console.log(`StableCoinMock users[${i}] ${user} balance`, ethers.utils.formatUnits(balance, 6));
    }
}