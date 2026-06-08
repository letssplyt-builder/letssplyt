import app from './app';
import logger from './infrastructure/logger';

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  logger.info({ msg: 'LetsSplyt backend running', port: PORT });
});
