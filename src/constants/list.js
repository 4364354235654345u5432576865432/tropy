'use strict'

module.exports = {
  ROOT: 0,

  CREATE: 'list.create',
  DELETE: 'list.delete',
  RESTORE: 'list.restore',
  PRUNE: 'list.prune',

  INSERT: 'list.insert',
  REMOVE: 'list.remove',

  SAVE: 'list.save',
  UPDATE: 'list.update',

  LOAD: 'list.load',

  ORDER: 'list.order',

  COLLAPSE: 'list.collapse',
  EXPAND: 'list.expand',

  ITEM: {
    ADD: 'list.item.add',
    REMOVE: 'list.item.remove',
    RESTORE: 'list.item.restore'
  }
}
