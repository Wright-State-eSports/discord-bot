import { mkdir, access, constants } from 'fs/promises';
async function directoryCheck() {
    try {
        await access(`${process.cwd()}/logs`, constants.F_OK | constants.W_OK | constants.R_OK);
    } catch (e) {
        await mkdir(`${process.cwd()}/logs`);
    }
}

directoryCheck();
