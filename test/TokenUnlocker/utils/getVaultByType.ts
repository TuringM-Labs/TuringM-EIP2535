

export const getVaultByType = async (type: string) => {
    const network = hre.network.name
    const file = path.resolve(__dirname, `../../../deployments/${network}-vault.json`)
    const vaultDataArr = require(file)

    const vaultType = getConfig('VaultType')[type]
    const vaultData = _.shuffle(_.filter(vaultDataArr, (vault: any) => vault.vaultType === vaultType))[0]
    return vaultData
}