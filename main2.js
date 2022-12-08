// we start with an empty sudoku...
var sudoku = new Array(
  0,	// 0
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,

  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,

  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,

  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,

  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,

  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,

  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,

  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,

  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0, // 99
);

// si pone il problema: analizzare prima o dopo le celle libere? Le guardo rispetto al precedente o al successivo? in questo caso le stiamo guardando
// al successivo.

function checkAvailable(pivot, currNum){
  console.log("checkAvailable");
  prevNumber = parseInt(currNum) - 1;
  pivot_r = Math.floor(pivot/10);
  pivot_c = pivot % 10;
  
  // variabili nello scope di questa funzione
  available = 0;
  nord = parseInt(pivot) - 30;
  nordOvest = parseInt(pivot) - 22;
  nordEst = parseInt(pivot) - 18;
  ovest = parseInt(pivot) - 3;
  est = parseInt(pivot) + 3;
  sudOvest = parseInt(pivot) + 18;
  sudEst = parseInt(pivot) + 22;
  sud = parseInt(pivot) + 30;


  console.log("135");
  nord_r = pivot_r -3;
  nord_c = pivot_c;
  if (nord_r >= 0 && nord_c >= 0){ // in bounds
    if(sudoku[nord] == 0){
      document.getElementById(nord).style.backgroundColor = 'green';
      available++;
    }
    else{
      document.getElementById(nord).style.backgroundColor = 'grey';
    }
  }

  console.log("148");
  n_o_r = pivot_r -2;
  n_o_c = pivot_c -2;
  if (n_o_r >= 0 && n_o_c >= 0){ // in bounds
    if(sudoku[nordOvest] == 0){
      document.getElementById(nordOvest).style.backgroundColor = 'green';
      available++;
    }
    else{
      document.getElementById(nordOvest).style.backgroundColor = 'grey';
    }
  }
  
  n_e_r = pivot_r -2;
  n_e_c = pivot_c +2;
  if (n_e_r >= 0 && n_e_c <10){ // in bounds
    if(sudoku[nordEst] == 0){
      document.getElementById(nordEst).style.backgroundColor = 'green';
      available++;
    }
    else{
      document.getElementById(nordEst).style.backgroundColor = 'grey';
    }
  }

  est_r = pivot_r;
  est_c = pivot_c +3;
  if (est_r >= 0 && est_c <10){ // in bounds
    if(sudoku[est] == 0){
      document.getElementById(est).style.backgroundColor = 'green';
      available++;
    }
    else{
      document.getElementById(est).style.backgroundColor = 'grey';
    }
  }
  console.log("184");
  s_e_r = pivot_r +2;
  s_e_c = pivot_c +2;
  //window.alert("sudest r: " + s_o_s_e_rr+"sudest c: " + s_e_c);
  if (s_e_r < 10 && s_e_c <10){ // in bounds
    if(sudoku[sudEst] == 0){
      document.getElementById(sudEst).style.backgroundColor = 'green';
      available++;
    }
    else{
      document.getElementById(sudEst).style.backgroundColor = 'grey';
    }
  }

  s_o_r = pivot_r +2;
  s_o_c = pivot_c -2;
  //window.alert("nest r: " + s_o_r+"sudovest c: " + s_o_c);
  if (s_o_r < 10 && s_o_c >= 0){ // in bounds
    //window.alert("if sudovest");
    if(sudoku[sudOvest] == 0){
      document.getElementById(sudOvest).style.backgroundColor = 'green';
      available++;
    }
    else{
      document.getElementById(sudOvest).style.backgroundColor = 'grey';
    }
  }

  o_r = pivot_r;
  o_c = pivot_c -3;
  if (o_r >= 0 && o_c >= 0){ // in bounds
    if(sudoku[ovest] == 0){
      document.getElementById(ovest).style.backgroundColor = 'green';
      available++;
    }
    else{
      document.getElementById(ovest).style.backgroundColor = 'grey';
    }
  }


  sud_r = pivot_r +3;
  sud_c = pivot_c;
  if (sud_r < 10 && sud_c < 10){ // in bounds
    if(sudoku[sud] == 0){
      document.getElementById(sud).style.backgroundColor = 'green';
      available++;
    }
    else{
      document.getElementById(sud).style.backgroundColor = 'grey';
    }
  }
  console.log("236");
  //window.alert("available: "+available);
  return available;
}


// qui è diverso dal controllare le celle disponibili. non c'è il pivot, bensì il click che abbiamo fatto. 

// qui devo verificare che la cella cliccata sia collegata legalmente al numero precedente oppure controllare il colore
function move(click, currNum){
  var diocan = document.getElementById(click).style.backgroundColor;
  console.log("colore cella: "+diocan);
  if (diocan == "green" || currNum == 1){
    document.getElementById("title").innerHTML = 
    "Mossa numero: " + (cnt);
    return 1;
  }
  else{
    console.log("move was illegal, color: " + diocan);
    return 0;
  }
}



function clearSuggestions(){
	// resetta le celle disponibili
	for (let i = 0; i < 100; i++) { 
		document.getElementById(i).style.backgroundColor = 'white';
	}
}
	
var cnt = 1;
function input(x) {
  if (sudoku[x] == 0) {
    if (cnt < 101 && move(x,cnt)){
      document.getElementById(x).innerHTML = cnt;     // scrivi il numero sulla pagina
      document.getElementById(x).style.color = "blue";  // colora il numero
      sudoku[x] = cnt;                                    // scrivi il numero sull'array
      cnt++;
      clearSuggestions();
      disp = checkAvailable(x,cnt);
      console.log("Celle verdi: "+disp);
    }  
  }
  else{
	  console.log("cell occupied");
  }
  

  if (disp == 0){
    lastNum = cnt --;
    window.alert("Game lost at: " + lastNum);
  }
}



var seconds = 0;
var second = 0;
var minutes = 0;
setInterval(timer, 1000);
function timer() {
  document.getElementById("time").innerHTML =
    "Time " + pad(minutes) + ":" + pad(second);

  second = seconds - minutes * 60;
  seconds++;
  minutes = Math.floor(seconds / 60);
}

function pad(d) {
  return d < 10 ? "0" + d.toString() : d.toString();
}

function changeColor(x) {
  document.getElementById(x).classList.remove("onfocused");
}
