// @ts-nocheck

/**
 * A Fireproof database Listener allows you to react to events in the database.
 *
 * @class Listener
 * @classdesc An listener attaches to a Fireproof database and runs a routing function on each change, sending the results to subscribers.
 *
 * @param {import('./database').Database} database - The Database database instance to index.
 * @param {Function} routingFn - The routing function to apply to each entry in the database.
 */
// import { ChangeEvent } from './db-index'
/**
 * @deprecated since version 0.7.0
 */
export class Listener {
  subcribers = new Map()
  doStopListening = null

  /**
   * @param {import('./database').Database} database
   * @param {(_: any, emit: any) => void} routingFn
   */
  constructor (
    database,
    routingFn = function (/** @type {any} */ _, /** @type {(arg0: string) => void} */ emit) {
      emit('*')
    }
  ) {
    this.database = database
    this.doStopListening = database.registerListener((/** @type {any} */ changes) => this.onChanges(changes))
    /**
     * The map function to apply to each entry in the database.
     * @type {Function}
     */
    this.routingFn = routingFn

    this.dbHead = null
  }

  /**
   * Subscribe to a topic emitted by the event function.
   * @param {string} topic - The topic to subscribe to.
   * @param {Function} subscriber - The function to call when the topic is emitted.
   * @returns {Function} A function to unsubscribe from the topic.
   * @memberof Listener
   * @instance
   * @param {any} [since] - clock to flush from on launch, pass null for all
   */
  on (topic, subscriber, since = undefined) {
    const listOfTopicSubscribers = getTopicList(this.subcribers, topic)
    listOfTopicSubscribers.push(subscriber)
    if (typeof since !== 'undefined') {
      this.database.changesSince(since).then(({ rows: changes }) => {
        const keys = topicsForChanges(changes, this.routingFn).get(topic)
        if (keys) keys.forEach((/** @type {any} */ key) => subscriber(key))
      })
    }
    return () => {
      const index = listOfTopicSubscribers.indexOf(subscriber)
      if (index > -1) listOfTopicSubscribers.splice(index, 1)
    }
  }

  /**
   * @typedef {import('./db-index').ChangeEvent} ChangeEvent
   */

  /**
   * @param {ChangeEvent[]} changes
   */
  onChanges (changes) {
    if (Array.isArray(changes)) {
      const seenTopics = topicsForChanges(changes, this.routingFn)
      for (const [topic, keys] of seenTopics) {
        const listOfTopicSubscribers = getTopicList(this.subcribers, topic)
        listOfTopicSubscribers.forEach((/** @type {(arg0: any) => any} */ subscriber) =>
          keys.forEach((/** @type {any} */ key) => subscriber(key))
        )
      }
    } else {
      // non-arrays go to all subscribers
      for (const [, listOfTopicSubscribers] of this.subcribers) {
        listOfTopicSubscribers.forEach((/** @type {(arg0: any) => any} */ subscriber) => subscriber(changes))
      }
    }
  }
}

/**
 * @param {Map<any, any>} subscribersMap
 * @param {string} name
 */
function getTopicList (subscribersMap, name) {
  let topicList = subscribersMap.get(name)
  if (!topicList) {
    topicList = []
    subscribersMap.set(name, topicList)
  }
  return topicList
}

/**
 * Transforms a set of changes to events using an emitter function.
 *
 * @param {ChangeEvent[]} changes
 * @param {Function} routingFn
 * @returns {Map<string,string[]>} The topics emmitted by the event function.
 * @private
 */
const topicsForChanges = (changes, routingFn) => {
  const seenTopics = new Map()
  changes.forEach(({ key, value, del }) => {
    if (del || !value) value = { _deleted: true }
    routingFn({ _id: key, ...value }, (/** @type {any} */ t) => {
      const topicList = getTopicList(seenTopics, t)
      topicList.push(key)
    })
  })
  return seenTopics
}
