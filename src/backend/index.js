/**
 * Something to get us started, nothing sacred here, everything can change!
 */

const fs = require('fs');
const { logger } = require('./utils/logger');
const feedQueue = require('./feed/queue');
const feedWorker = require('./feed/worker');

const log = logger.child({ module: 'basic-queue' });
// Start the web server
require('./web/server');

/**
 * Process a string into a list of Objects, each with a feed URL
 * @param {String} lines
 */
function processFeedUrls(lines) {
  return (
    lines
      // Divide the file into separate lines
      .split(/\r?\n/)
      // Basic filtering to remove any ines that don't look like a feed URL
      .filter(line => line.startsWith('http'))
      // Convert this into an Object of the form expected by our queue
      .map(url => ({ url }))
  );
}

/**
 * Adds feed URL jobs to the feed queue for processing
 * @param {Array[Object]} feedJobs - list of feed URL jobs to be processed
 */
async function enqueueFeedJobs(feedJobs) {
  feedJobs.forEach(async feedJob => {
    log.info(`Enqueuing Job - ${feedJob.url}`);
    await feedQueue.add(feedJob, {
      attempts: 8,
      backoff: {
        type: 'exponential',
        delay: 60 * 1000,
      },
      removeOnComplete: true,
      removeOnFail: true,
    });
  });
}

/**
 * For now, do something simple and just read a few feeds from a text file
 */
fs.readFile('feeds.txt', 'utf8', (err, lines) => {
  if (err) {
    log.error('unable to read initial list of feeds', err.message);
    process.exit(-1);
    return;
  }

  // Process this text file into a list of URL jobs, and enqueue for download
  const feedJobs = processFeedUrls(lines);

  enqueueFeedJobs(feedJobs)
    .then(() => {
      feedWorker.start();
    })
    .catch(error => {
      log.error(error);
    });
});
