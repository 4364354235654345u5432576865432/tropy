'use strict'

const { call, put, select } = require('redux-saga/effects')
const { Command } = require('./command')
const { ImportCommand } = require('./import')
const { SaveCommand } = require('./subject')
const { Image } = require('../image')
const mod = require('../models')
const act = require('../actions')
const { SELECTION } = require('../constants')
const { pick, splice } = require('../common/util')
const { keys } = Object

const {
  getSelectionTemplate,
  getTemplateValues
} = require('../selectors')


class Create extends ImportCommand {
  static get ACTION() { return SELECTION.CREATE }

  *exec() {
    let { db } = this.options
    let { payload, meta } = this.action

    let [photo, template, density] = yield select(state => ([
      state.photos[payload.photo],
      getSelectionTemplate(state),
      state.settings.density
    ]))

    let image = yield call(Image.open, {
      ...photo,
      density: photo.density || density
    })

    let idx = (meta.idx != null) ? meta.idx : [photo.selections.length]
    let data = getTemplateValues(template)

    let selection = yield call(db.transaction, tx =>
      mod.selection.create(tx, {
        data,
        template: template.id,
        ...payload
      }))

    yield* this.createThumbnails(selection.id, image, { selection })

    let common = { selections: [selection.id] }

    yield put(act.photo.selections.add({ id: photo.id, ...common }, { idx }))

    this.undo = act.selection.delete({ photo: photo.id, ...common }, { idx })
    this.redo = act.selection.restore({ photo: photo.id, ...common }, { idx })

    return selection
  }
}

class Delete extends Command {
  static get ACTION() { return SELECTION.DELETE }

  *exec() {
    let { db } = this.options
    let { payload } = this.action
    let { photo, selections } = payload

    let ord = yield select(({ photos }) => photos[photo].selections)
    let idx = selections.map(id => ord.indexOf(id))

    ord = ord.filter(id => !selections.includes(id))

    yield call(db.transaction, async tx => {
      await mod.selection.delete(tx, ...selections)
      await mod.selection.order(tx, photo, ord)
    })

    yield put(act.photo.selections.remove({ id: photo, selections }))

    this.undo = act.selection.restore(payload, { idx })
  }
}

class Load extends Command {
  static get ACTION() { return SELECTION.LOAD }

  *exec() {
    const { db } = this.options
    const { payload } = this.action

    const selections = yield call(db.seq, conn =>
      mod.selection.load(conn, payload))

    return selections
  }
}

class Order extends Command {
  static get ACTION() { return SELECTION.ORDER }

  *exec() {
    const { db } = this.options
    const { payload } = this.action
    const { photo, selections } = payload

    const cur = yield select(({ photos }) => photos[photo].selections)

    yield call(mod.selection.order, db, photo, selections)
    yield put(act.photo.update({ id: photo, selections }))

    this.undo = act.selection.order({ photo, selections: cur })
  }
}

class Restore extends Command {
  static get ACTION() { return SELECTION.RESTORE }

  *exec() {
    const { db } = this.options
    const { payload, meta } = this.action
    const { photo, selections } = payload

    // Restore all selections in a batch at the former index
    // of the first selection to be restored. Need to differentiate
    // if we support selecting multiple selections!
    let [idx] = meta.idx

    let ord = yield select(({ photos }) => photos[photo].selections)
    ord = splice(ord, idx, 0, ...selections)

    yield call(db.transaction, async tx => {
      await mod.selection.restore(tx, ...selections)
      await mod.selection.order(tx, photo, ord)
    })

    yield put(act.photo.selections.add({ id: photo, selections }, { idx }))

    this.undo = act.photo.delete(payload)
  }
}

class Save extends Command {
  static get ACTION() { return SELECTION.SAVE }

  *exec() {
    const { db } = this.options
    const { payload, meta } = this.action
    const { id, data } = payload

    const original = yield select(state =>
      pick(state.selections[id], keys(data)))

    yield call(db.transaction, tx =>
      mod.image.save(tx, { id, timestamp: meta.now, ...data }))

    this.undo = act.selection.save({ id, data: original })

    return { id, ...data }
  }
}

class TemplateChange extends SaveCommand {
  static get ACTION() { return SELECTION.TEMPLATE.CHANGE }
  get type() { return 'selection' }
}



module.exports = {
  Create,
  Delete,
  Load,
  Order,
  Restore,
  Save,
  TemplateChange
}
