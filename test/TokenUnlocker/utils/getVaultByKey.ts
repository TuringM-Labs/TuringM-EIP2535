export const getVaultByKey = (key: string) => {
    const network = hre.network.name
    const file = path.resolve(__dirname, `../../../deployments/${network}-data/vault.json`)
    const vaultDataArr = require(file)

    const data = _.find(vaultDataArr, (vault: any) => vault.name === `${key} vault`)
    return data
}