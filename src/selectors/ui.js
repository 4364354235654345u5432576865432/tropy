'use strict'

const { createSelector: memo } = require('reselect')
const { getVisiblePhotos } = require('./photos')
const { seq, compose, map, keep } = require('transducers.js')
const { get } = require('../common/util')

const rev = (a, b) => a < b ? 1 : b < a ? -1 : 0

const getActiveImageProps = memo(
  ({ esper }) => esper.view,
  ({ nav }) => nav.photo,
  ({ nav }) => nav.selection,
  (view, photo, selection) =>
    get(view, [selection || photo]) || {}
)

const getExpandedPhotos = memo(
  ({ ui }) => ui.expand,
  ({ ui }) => ui.panel.zoom > 0,
  getVisiblePhotos,
  (expand, isGrid, photos) => {
    const expanded = seq(photos, compose(
      map(photo => expand[photo.id] > 0 ? photo : null),
      keep()
    ))

    if (isGrid) {
      expanded.sort((a, b) => rev(expand[a.id], expand[b.id]))
    }

    return expanded
  }
)

const getActiveNoteProps = memo(
  ({ notepad }) => notepad,
  ({ nav }) => nav.note,
  (notepad, id) => notepad[id] || {}
)

module.exports = {
  getActiveImageProps,
  getActiveNoteProps,
  getExpandedPhotos
}
