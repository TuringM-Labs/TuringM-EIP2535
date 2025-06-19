const scope = getNameForTag(__dirname, __filename, 3)
const theDebug = require('debug')(`test:${scope}`)
export const faucetUsersTUIT = async amount => {
    const contract = await getContractWithSignerKey('TuringToken', 'superAdmin');
    const users = await getUnnamedAccounts();
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const tx = await contract.transfer(user, ethers.utils.parseEther(amount + ''));
        await tx.wait();
        const balance = await contract.balanceOf(user);
        theDebug(`TuringToken users[${i}] ${user} balance`, balance.toString());
    }
}