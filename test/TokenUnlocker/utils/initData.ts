export default createInitData(async ({ deployments }) => {
    await deployments.fixture(['TokenUnlocker:99_All'])
    return {
    }
})