let field_game = document.querySelector('#field_game table tbody');
let first_click = null;
let rewrite_btn = document.querySelector('.rewrite-btn');
let check_btn = document.querySelector('.check-btn');
let count_tr = document.querySelector('.count-tr');
let count_high = document.querySelector('.count-high');
let save_btn = document.querySelector('.save-btn');
let restore_btn = document.querySelector('.restore-btn');
let save_check = false;
let restore_check = false;
let total_active_tr = document.querySelector('.total-active-tr');
let total_active_td = document.querySelector('.total-active-td');
let back = document.querySelector('.back');
let array_history = [];

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

//гля, підходить чи ні
function checkBox(check, element) {
    if (check) {
        if (check === element) {
            if
            (first_click.innerText === element.innerText || parseInt(first_click.innerText) +
                parseInt(element.innerText) === 10) {
                first_click.classList.add('close-box');
                element.classList.add('close-box');
                array_history.push([first_click, element]);
                first_click.classList.remove('click-box');
                first_click = null
                soundForBox('close');
                removeTr();
                countActiveTd();
                finishGame();
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    } else {
        return false;
    }
}

function finishGame() {
    let array_number = document.querySelectorAll('td:not(.close-box)');
    if (!array_number.length) {
        alert('Молодець :p) :) :^');
    }
}

function removeTr() {
    let array_tr = field_game.querySelectorAll('tr');
    for (let i = 0; i < array_tr.length; i++) {
        let td = array_tr[i].querySelector('td:not(.close-box)');
        if (!td) {
            array_tr[i].classList.add('remove-box');
            soundForBox('remove');
            setTimeout(function () {
                array_tr[i].remove();
            }, 1000)
            countTr();
            countActiveTr();
        }
    }
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

function countActiveTr() {
    let temp_tr = field_game.querySelectorAll('tr');
    total_active_tr.innerText = temp_tr.length.toString();
}

function countActiveTd() {
    let temp_td = field_game.querySelectorAll('td:not(.close-box)');
    total_active_td.innerText = temp_td.length.toString();
}

back.addEventListener('click', function () {
    let last = array_history.pop();
    if (last) {
        if(last[0] && last[1]) {
            last[0].classList.remove('close-box');
            last[1].classList.remove('close-box');
        }
        countActiveTd();
    } else {
        array_history = [];
    }
});

rewrite_btn.addEventListener('click', function () {
    let array_number = field_game.querySelectorAll('td:not(.close-box)');
    if (array_number.length) {
        let last_tr = field_game.querySelector('tr:last-child');
        let tr = document.createElement('tr');
        let td = document.createElement('td');
        for (let i = 0; i < array_number.length; i++) {
            td.innerText = array_number[i].innerText;
            if (last_tr.children.length < 9) {
                last_tr.append(
                    td.cloneNode(true)
                )
            } else {
                tr.append(td.cloneNode(true));
                if (tr.children.length === 9 || i === array_number.length - 1) {
                    field_game.append(tr.cloneNode(true));
                    tr.innerHTML = '';
                }
            }
        }
        countActiveTr();
        countActiveTd();
    } else {
        alert('Молодець ))');
    }
});

check_btn.addEventListener('click', function () {
    let array_td = field_game.querySelectorAll('td:not(.close-box)');

    if (array_td.length) {
        for (let i = 0; i < array_td.length; i++) {
            let temp_td = recursCheckPreviousTd(array_td[i]);
            if (temp_td) {
                if (temp_td.innerText === array_td[i].innerText ||
                    parseInt(temp_td.innerText) + parseInt(array_td[i].innerText) === 10) {
                    informer('Так, ще є');
                    return;
                }
            }

            temp_td = recursCheckNextTd(array_td[i]);
            if (temp_td) {
                if (temp_td.innerText === array_td[i].innerText ||
                    parseInt(temp_td.innerText) + parseInt(array_td[i].innerText) === 10) {
                    informer('Так, ще є');
                    return;

                }
            }

            temp_td = recursCheckDownTd(array_td[i]);
            if (temp_td) {
                if (temp_td.innerText === array_td[i].innerText ||
                    parseInt(temp_td.innerText) + parseInt(array_td[i].innerText) === 10) {
                    informer('Так, ще є');
                    return;
                }
            }

            temp_td = recursCheckUpTd(array_td[i]);
            if (temp_td) {
                if (temp_td.innerText === array_td[i].innerText ||
                    parseInt(temp_td.innerText) + parseInt(array_td[i].innerText) === 10) {
                    informer('Так, ще є');
                    return;
                }
            }
        }

        informer('Ні, більше немає', 'warning');
    }
});

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

});