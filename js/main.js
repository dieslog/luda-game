let field_game = document.querySelector('#field_game table tbody');
let first_click = null;
let rewrite_btn = document.querySelector('.rewrite-btn');
let check_btn = document.querySelector('.check-btn');
let hint_btn = document.querySelector('.hint-btn');
let count_tr = document.querySelector('.count-tr');
let count_high = document.querySelector('.count-high');
let save_btn = document.querySelector('.save-btn');
let restore_btn = document.querySelector('.restore-btn');
let save_check = false;
let restore_check = false;
let total_active_tr = document.querySelector('.total-active-tr');
let total_active_td = document.querySelector('.total-active-td');
let back = document.querySelector('.back');

// Two kinds of undoable entries:
//  - match:   { type: 'match', cells: [tdA, tdB], removedRows: [{ tr, anchor, timeoutId }] }
//  - rewrite: { type: 'rewrite', addedCellsToLastTr: [td...], addedRows: [tr...] }
let array_history = [];

// Row-removal animation duration in ms. Must stay in sync with the
// `remove-cell` keyframes (+ the small per-cell stagger delay) in main.css.
const ROW_REMOVE_DELAY = 650;
const HINT_DURATION = 1800;

field_game.addEventListener('click', function (e) {
    let element = e.target;
    if (element.nodeName !== 'TD') {
        return;
    }
    if (element.classList.contains('close-box')) {
        return;
    }
    if (element === first_click) {
        element.classList.toggle('click-box');
        if (!element.classList.contains('click-box')) {
            first_click = null;
        }
        return;
    }

    if (first_click === null) {
        element.classList.toggle('click-box');
        first_click = element;
    } else {

        //Перевірка на те, підходить елемент чи ні. Однакове значення обо те що дає в сумі 10 означає окей.
        if (checkBox(recursCheckPreviousTd(first_click), element)) {
            return true;
        } else if (checkBox(recursCheckNextTd(first_click), element)) {
            return true;
        } else if (checkBox(recursCheckDownTd(first_click), element)) {
            return true;
        } else if (checkBox(recursCheckUpTd(first_click), element)) {
            return true;
        } else {
            first_click.classList.remove('click-box');
            first_click = null
        }
    }
});

//наліво
function recursCheckPreviousTd(element) {
    if (element.previousElementSibling) {
        let check = element.previousElementSibling;
        if (!check.classList.contains('close-box')) {
            return check;
        } else {
            return recursCheckPreviousTd(check);
        }
    } else {
        if (element.parentElement.previousElementSibling) {
            let last_child = element.parentElement.previousElementSibling.children[8];
            if (!last_child.classList.contains('close-box')) {
                return last_child;
            } else {
                return recursCheckPreviousTd(last_child);
            }
        } else {
            return false;
        }
    }
}

//направо
function recursCheckNextTd(element) {
    if (element.nextElementSibling) {
        let check = element.nextElementSibling;

        if (!check.classList.contains('close-box')) {
            return check;
        } else {
            return recursCheckNextTd(check);
        }
    } else {
        if (element.parentElement.nextElementSibling) {
            let first_child = element.parentElement.nextElementSibling.children[0];
            if (!first_child.classList.contains('close-box')) {
                return first_child;
            } else {
                return recursCheckNextTd(first_child);
            }
        } else {
            return false;
        }
    }
}

//вниз
function recursCheckDownTd(element) {
    let sell_index = element.cellIndex;
    if (element.parentElement.nextElementSibling) {
        if (element.parentElement.nextElementSibling.children[sell_index]) {
            let check = element.parentElement.nextElementSibling.children[sell_index];
            if (!check.classList.contains('close-box')) {
                return check;
            } else {
                return recursCheckDownTd(check);
            }
        } else {
            return false;
        }
    } else {
        return false;
    }
}

//вверх
function recursCheckUpTd(element) {
    let sell_index = element.cellIndex;
    if (element.parentElement.previousElementSibling) {
        if (element.parentElement.previousElementSibling.children[sell_index]) {
            let check = element.parentElement.previousElementSibling.children[sell_index];
            if (!check.classList.contains('close-box')) {
                return check;
            } else {
                return recursCheckUpTd(check);
            }
        } else {
            return false;
        }
    } else {
        return false;
    }
}

function isMatch(a, b) {
    return a.innerText === b.innerText || parseInt(a.innerText) + parseInt(b.innerText) === 10;
}

// Looks through every open cell in all four directions for the first valid
// pair. Shared by "Чи є ще?" and "Підказка" so both stay in sync.
function findMatchingPair() {
    let array_td = field_game.querySelectorAll('td:not(.close-box)');
    let directions = [recursCheckPreviousTd, recursCheckNextTd, recursCheckDownTd, recursCheckUpTd];

    for (let i = 0; i < array_td.length; i++) {
        for (let d = 0; d < directions.length; d++) {
            let neighbour = directions[d](array_td[i]);
            if (neighbour && isMatch(array_td[i], neighbour)) {
                return [array_td[i], neighbour];
            }
        }
    }
    return null;
}

//гля, підходить чи ні
function checkBox(check, element) {
    if (!check || check !== element) {
        return false;
    }

    if (!isMatch(first_click, element)) {
        return false;
    }

    let cellA = first_click;
    let cellB = element;

    cellA.classList.add('close-box');
    cellB.classList.add('close-box');
    cellA.classList.remove('click-box');
    first_click = null;
    soundForBox('close');

    let historyEntry = {type: 'match', cells: [cellA, cellB], removedRows: []};
    array_history.push(historyEntry);

    removeTr(historyEntry);
    countActiveTd();
    finishGame();
    return true;
}

function finishGame() {
    let array_number = document.querySelectorAll('td:not(.close-box)');
    if (!array_number.length) {
        alert('Молодець :p) :) :^');
    }
}

// Finds every row that just became fully closed, animates it out, and
// records enough information (the row itself, an anchor node to reinsert
// before, and the pending removal timeout) so that "back" can fully restore
// it later — even if several rows disappear from a single move.
function removeTr(historyEntry) {
    let array_tr = Array.from(field_game.querySelectorAll('tr'));
    let toRemove = [];

    for (let i = 0; i < array_tr.length; i++) {
        let td = array_tr[i].querySelector('td:not(.close-box)');
        if (!td) {
            toRemove.push(array_tr[i]);
        }
    }

    if (!toRemove.length) {
        return;
    }

    soundForBox('remove');

    toRemove.forEach(function (tr) {
        let anchor = tr.nextElementSibling;
        while (anchor && toRemove.includes(anchor)) {
            anchor = anchor.nextElementSibling;
        }

        tr.classList.add('remove-box');

        let timeoutId = setTimeout(function () {
            tr.remove();
            // The row that's now flush against the top has changed once
            // this one is actually gone, not just faded out.
            schedulePinnedRowUpdate();
        }, ROW_REMOVE_DELAY);

        historyEntry.removedRows.push({tr: tr, anchor: anchor, timeoutId: timeoutId});
        countTr();
    });

    total_active_tr.innerText = (array_tr.length - toRemove.length).toString();
    schedulePinnedRowUpdate();
}

function countTr() {
    let temp_count_tr = ++count_tr.innerText
    let temp_count_high = +localStorage.getItem('count_high');

    if (temp_count_tr > temp_count_high) {
        count_high.innerText = temp_count_tr;
        localStorage.setItem('count_high', temp_count_tr.toString());
    }

    count_tr.innerText = temp_count_tr;
}

function soundForBox(turn) {
    let array_sound = {
        close: './audio/close.mp3',
        remove: './audio/remove.mp3',
    };
    let sound = new Audio();

    sound.volume = 0.2;
    sound.src = array_sound[turn];
    sound.play();
}

// A small fixed bar shows, for each of the 9 columns, whichever still-active
// cell is nearest to the visible viewport among everything that's scrolled
// above it — skipping already-closed (green) cells, and pulling from
// whichever row happens to have the closest surviving cell in that column
// (not necessarily all from the same row). We only rebuild the preview's
// contents when what it should show actually changes, so it doesn't
// flicker while scrolling.
let pinned_preview = document.querySelector('.pinned-row-preview');
let pinned_preview_row = document.querySelector('.pinned-row-preview__row');
let lastPreviewSignature = null;
let previewRafId = null;

function updatePinnedPreview() {
    let rows = field_game.querySelectorAll('tr');
    let nearestByColumn = new Array(9).fill(null);
    let anyHidden = false;

    // The bar itself sits on top of the page and covers whatever's behind
    // it, so "hidden" isn't just rect.bottom <= 0 — it's rect.bottom <=
    // the bar's own height (plus a little extra buffer so the swap happens
    // slightly before a cell is actually half-covered, not exactly when
    // it is). offsetHeight is used (not the animated/translated rect)
    // since it reflects the bar's real size regardless of whether it's
    // currently slid into view.
    let barHeight = pinned_preview.offsetHeight + 25;

    // Rows come out in top-to-bottom order, so as we walk through the ones
    // that have scrolled fully behind the bar, later matches in the same
    // column simply overwrite earlier ones — leaving each column's slot
    // holding whichever cell is closest to the visible area.
    rows.forEach(function (row) {
        if (row.getBoundingClientRect().bottom > barHeight) {
            return;
        }
        anyHidden = true;
        Array.from(row.children).forEach(function (cell) {
            if (!cell.classList.contains('close-box')) {
                nearestByColumn[cell.cellIndex] = cell.innerText;
            }
        });
    });

    if (!anyHidden || nearestByColumn.every(function (v) { return v === null; })) {
        pinned_preview.classList.remove('is-visible');
        lastPreviewSignature = null;
        return;
    }

    let signature = nearestByColumn.join(',');
    if (signature !== lastPreviewSignature) {
        pinned_preview_row.innerHTML = '';
        let table = document.createElement('table');
        let tbody = document.createElement('tbody');
        let tr = document.createElement('tr');

        nearestByColumn.forEach(function (value) {
            let td = document.createElement('td');
            if (value === null) {
                td.classList.add('empty-slot');
            } else {
                td.textContent = value;
            }
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
        table.appendChild(tbody);
        pinned_preview_row.appendChild(table);
        lastPreviewSignature = signature;
    }

    pinned_preview.classList.add('is-visible');
}

function schedulePinnedRowUpdate() {
    if (previewRafId !== null) {
        return;
    }
    previewRafId = requestAnimationFrame(function () {
        previewRafId = null;
        updatePinnedPreview();
    });
}

window.addEventListener('scroll', schedulePinnedRowUpdate, {passive: true});
window.addEventListener('resize', schedulePinnedRowUpdate);

function countActiveTr() {
    let temp_tr = field_game.querySelectorAll('tr');
    total_active_tr.innerText = temp_tr.length.toString();
    schedulePinnedRowUpdate();
}

function countActiveTd() {
    let temp_td = field_game.querySelectorAll('td:not(.close-box)');
    total_active_td.innerText = temp_td.length.toString();
}

back.addEventListener('click', function () {
    let last = array_history.pop();
    if (!last) {
        return;
    }

    if (last.type === 'rewrite') {
        // "Переписати" only ever appends cells/rows to the end of the board,
        // so undoing it just means removing exactly what was added.
        last.addedRows.slice().reverse().forEach(function (row) {
            row.remove();
        });
        last.addedCellsToLastTr.slice().reverse().forEach(function (cell) {
            cell.remove();
        });
        countActiveTr();
        countActiveTd();
        return;
    }

    // Restore every row this move removed — cancelling the pending removal
    // if the animation hadn't finished yet, or re-inserting the row at its
    // original position if it was already taken out of the DOM.
    last.removedRows.forEach(function (entry) {
        clearTimeout(entry.timeoutId);
        entry.tr.classList.remove('remove-box');

        if (!entry.tr.parentNode) {
            if (entry.anchor && entry.anchor.parentNode === field_game) {
                field_game.insertBefore(entry.tr, entry.anchor);
            } else {
                field_game.appendChild(entry.tr);
            }
        }

        entry.tr.classList.add('restore-row');
        setTimeout(function () {
            entry.tr.classList.remove('restore-row');
        }, 400);

        let temp_count_tr = +count_tr.innerText - 1;
        count_tr.innerText = (temp_count_tr < 0 ? 0 : temp_count_tr).toString();
    });

    // Reopen the two cells this move had closed.
    last.cells.forEach(function (cell) {
        cell.classList.remove('close-box');
        cell.classList.add('restore-highlight');
        setTimeout(function () {
            cell.classList.remove('restore-highlight');
        }, 550);
    });

    countActiveTr();
    countActiveTd();
});

rewrite_btn.addEventListener('click', function () {
    let array_number = field_game.querySelectorAll('td:not(.close-box)');
    if (!array_number.length) {
        alert('Молодець ))');
        return;
    }

    // "Переписати" appends a fresh copy of every still-open number to the
    // end of the board — it never touches existing rows/cells. That means
    // undoing it is precise: just remove exactly what got added.
    let addedCellsToLastTr = [];
    let addedRows = [];

    let last_tr = field_game.querySelector('tr:last-child');
    let tr = document.createElement('tr');
    let td = document.createElement('td');
    for (let i = 0; i < array_number.length; i++) {
        td.innerText = array_number[i].innerText;
        if (last_tr.children.length < 9) {
            let newCell = td.cloneNode(true);
            last_tr.append(newCell);
            addedCellsToLastTr.push(newCell);
        } else {
            tr.append(td.cloneNode(true));
            if (tr.children.length === 9 || i === array_number.length - 1) {
                let newRow = tr.cloneNode(true);
                field_game.append(newRow);
                addedRows.push(newRow);
                tr.innerHTML = '';
            }
        }
    }

    array_history.push({
        type: 'rewrite',
        addedCellsToLastTr: addedCellsToLastTr,
        addedRows: addedRows
    });

    countActiveTr();
    countActiveTd();
});

check_btn.addEventListener('click', function () {
    if (!field_game.querySelectorAll('td:not(.close-box)').length) {
        return;
    }

    if (findMatchingPair()) {
        informer('Так, ще є');
    } else {
        informer('Ні, більше немає', 'warning');
    }
});

hint_btn.addEventListener('click', function () {
    if (!field_game.querySelectorAll('td:not(.close-box)').length) {
        return;
    }

    let pair = findMatchingPair();
    if (pair) {
        showHint(pair[0], pair[1]);
    } else {
        informer('Ні, більше немає', 'warning');
    }
});

function showHint(cellA, cellB) {
    cellA.classList.add('hint-box');
    cellB.classList.add('hint-box');
    setTimeout(function () {
        cellA.classList.remove('hint-box');
        cellB.classList.remove('hint-box');
    }, HINT_DURATION);
}

window.addEventListener('beforeunload', (event) => {
    event.returnValue = "";
});

save_btn.addEventListener('click', function () {
    if (!save_check) {

        let array_td = field_game.querySelectorAll('td');

        if (!array_td.length) {
            return;
        }

        let arrayBox = [];

        for (let i = 0; i < array_td.length; i++) {
            let num = 0;

            if (!array_td[i].classList.contains('close-box')) {
                num = +array_td[i].innerText;
            }

            arrayBox.push(num);
        }

        localStorage.setItem('arrayBox', arrayBox.toString());
        localStorage.setItem('level', count_tr.innerText);

        informer('Збережено');

        save_check = true;
        setTimeout(function () {
            save_check = false;
        }, 10000);

    } else {
        informer('Дуже часті збереження', 'warning');
    }
});

restore_btn.addEventListener('click', function () {
    if (!restore_check) {
        let arrayBox = localStorage.getItem('arrayBox');
        let level = localStorage.getItem('level');

        if (arrayBox && level) {
            field_game.innerHTML = '';
            let tr = document.createElement('tr');
            arrayBox = arrayBox.split(',');
            for (let i = 0; i < arrayBox.length; i++) {
                let td = document.createElement('td');
                if (!+arrayBox[i]) {
                    td.classList.add('close-box')
                }
                td.innerText = arrayBox[i];
                tr.append(td.cloneNode(true));
                if (tr.children.length === 9 || i === arrayBox.length - 1) {
                    field_game.append(tr.cloneNode(true));
                    tr.innerHTML = '';
                }
            }

            // Same reasoning as rewrite_btn: the DOM was fully replaced, so
            // old history entries are no longer valid.
            array_history = [];
            count_tr.innerText = level;
            countActiveTr();
            countActiveTd();
            informer('Відновлено');
        }
        restore_check = true;
        setTimeout(function () {
            restore_check = false;
        }, 10000);
    } else {
        informer('Дуже часті відновлення', 'warning');
    }
});

function informer(message, type = 'success') {
    toastr.options.timeOut = 2000;
    toastr.options.preventDuplicates = true;
    toastr.options.positionClass = 'toast-top-center';
    if (type === 'success') {
        toastr.success(message);
    } else if (type === 'warning') {
        toastr.warning(message);
    }
}

window.addEventListener('load', function () {
    let temp = localStorage.getItem('count_high');
    if (temp) {
        count_high.innerText = temp;
    } else {
        count_high.innerText = '0';
    }

    schedulePinnedRowUpdate();
});
