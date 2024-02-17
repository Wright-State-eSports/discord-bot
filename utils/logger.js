import pino from 'pino';
import chalk from 'chalk';


const logger = pino();
const fileTransport = pino.transport({
    target: 'pino/file',
    options: {
        destination: `${process.cwd()}/logs/`
    }
})

const info = async (message) => {
    logger.info(pino);
}