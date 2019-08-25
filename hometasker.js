/*
    Author
        Sergio Conejero Vicente

    HomeTasker
		977709031:AAEjHOdtq34OZddQLDygB8_bgeQxCWM0nFw
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Librerias */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const fs = require('fs'); // manejo de archivos de texto (JSON en este caso)

const TelegramBotAPI = require('node-telegram-bot-api'); // API Telegram

const generador_csv_writer = require('csv-writer').createObjectCsvWriter; // escritura facil y rapida de archivos CSV

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Path */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const TOKEN_PATH = './token.json';
const SESIONES_PATH = "./sesiones.json";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Telegram */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let TELEGRAM_TOKEN = undefined;

if (!fs.existsSync(TOKEN_PATH)) {
    console.log("Error, no se ha encontrado el archivo del token");
} else {
    let tokenFile = JSON.parse(fs.readFileSync(TOKEN_PATH));
    TELEGRAM_TOKEN = tokenFile['token'];
}

const telegramBot = new TelegramBotAPI(TELEGRAM_TOKEN, {
    polling: true
});

telegramBot.on('message', function (msg) {
    let userMessage = msg.text;
    let conversation = msg.chat.id;

    telegramBot.getChat(conversation).then(function (chat) {
        manageRequest(conversation, userMessage, chat.username);
    });
});




/* GLOBALS */
var triggerAvisoDiario;
var idUsuarioAsignadoAnterior = undefined;
var idUsuarioAsignadoActual = undefined;


/* INITIAL FUNCTIONS */
var sessions = cargarSesiones();
asignarTarea();
anunciarAsignacionTarea();

/* Variables de espera */
var esperandoNombre = false;
var esperandoConfirmacionTarea = true;


/* CORE */
function manageRequest(conversation, userMessage) {
	
    //Inicio conversacion
    if (userMessage === "/start" || sessions[conversation] === undefined) {
        
        if(sessions[conversation] === undefined){
        	sendMessage(conversation, "Hola, soy HomeTasker una herramienta de gestion domesticas colaborativa");
            createNewUser(conversation);
            sendMessage(conversation, "¿Como prefieres que te llame?");
            esperandoNombre = true;

        }else{
        	saludoEstandar(conversation);
        }         

    //Esperando respuestas
    } else {
        if(esperandoNombre){        	
            changeName(conversation, userMessage); 
			esperandoNombre = false;

		}else if(esperandoConfirmacionTarea){			
			let text = undefined;

			switch (userMessage) {
				case "Acepto" : case "/Acepto" : {
					text = "Te lo recordare mañana a las 9:00am.\nCuando termines usa /terminado";
					let minutos = 10;
					let recordatorio = "Recuerda limpiar antes de las 23:59 o seras penalizado";
					triggerAvisoDiario = trigger(idUsuarioAsignadoActual, recordatorio, minutos, 9);
					esperandoConfirmacionTarea = false;

					console.log(sessions[idUsuarioAsignadoActual]["nombre"]+" Acepto realizar la taria");
				}
				break;

				case "No estoy en casa" : case "/NoEstoy" : {
					text = "Espero que tengas una buena escusa para saltar el turno";
					esperandoConfirmacionTarea = false;
					console.log(sessions[idUsuarioAsignadoActual]["nombre"]+" indico que No esta en casa");

					cancelTrigger(triggerAvisoDiario);
					asignarTarea();
					anunciarAsignacionTarea();				

					

				}
				break;

				case "Reportar Usuario" : case "/Reportar" : {
					if(idUsuarioAsignadoAnterior != undefined){
						console.log(sessions[idUsuarioAsignadoActual]["nombre"]+" Reporto al usuario "+ sessions[idUsuarioAsignadoAnterior]["nombre"]);

						text = sessions[idUsuarioAsignadoAnterior]["nombre"]+" a sido penalizado";

						cancelTrigger(triggerAvisoDiario);
						asignarTarea();
						anunciarAsignacionTarea("reportado");

						esperandoConfirmacionTarea = false;

					}else{
						sendMessage(conversation, "No hay usuarios anteriores que reportar");
					}
				}
				break;

				default:{
					text = "Elige una opcion valida \n/Acepto /NoEstoy /Reportar";
				}

			}
			sendMessage(conversation, text);
		

    //Esperando Comandos     
        }else{

            switch (userMessage) {

                case "/changeName" : {
					sendMessage(conversation, "¿Como prefieres que te llame?");
					esperandoNombre = true;
                }
                    break;

                case "/terminado" : {
                	console.log("Terminado Recibido");
                	if(conversation == idUsuarioAsignadoActual && !esperandoConfirmacionTarea){
                		console.log(sessions[conversation]["nombre"]+" completo la tarea diaria");
                		sendMessage(conversation, "Has completado la tarea diaria");
						cancelTrigger(triggerAvisoDiario);
						
						asignarTarea();
						anunciarAsignacionTarea();
                	}else{
                		sendMessage(conversation, "No tienes ninguna tarea asignada");
                	}
                }
                    break;

            

                default: {
                	if(userMessage == undefined){
                		sendMessage(conversation, "Si me spameas te bloqueo");
                	}else if (userMessage.charAt(0) === '/') {
                        textoAyuda(conversation);
                    } else {
                    	//TEXTO NORMAL
                        let mensajeNormalizado = normalizaCadena(userMessage);
                        let respuesta = "No entiendo lo que dices";         

                        sendMessage(conversation, respuesta);
                    }
                }
            }
        }
    }
}




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Acciones */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function saludoEstandar(conversation) { 
    sendMessage(conversation, "Hola de nuevo "+sessions[conversation]["nombre"]);
}



function createNewUser(conversation){
    sessions[conversation] = {};
    sessions[conversation]["nombre"] =  null;
    sessions[conversation]["penalizaciones"] = 0;
    sessions[conversation]["tareaDiaria"] = {};
    sessions[conversation]["tareaDiaria"]["asignada"] = 0;
    sessions[conversation]["tareaDiaria"]["ultimoDiaCompletada"] = new Date(2000, 1, 1);;
    guardarSesiones(sessions);  
   
}


function changeName(conversation, userMessage){
    sessions[conversation]["nombre"] =  userMessage;
    guardarSesiones(sessions);
    sendMessage(conversation, "Te llamare "+userMessage+" entonces\n Que sepas que puedes cambiarlo con /changeName");
    esperandoNombre = false;
}


function asignarTarea(){
	let keys = Object.keys(sessions);
	var min = keys[0];
	//buscar fecha mas antigua
	keys.forEach(function (item) {	
		console.log(sessions[item]["nombre"]+" : "+sessions[item]["tareaDiaria"]["ultimoDiaCompletada"]);	


		if(sessions[min]["tareaDiaria"]["ultimoDiaCompletada"]>sessions[item]["tareaDiaria"]["ultimoDiaCompletada"]){
			min = item;
		}
	});

	sessions[min]["tareaDiaria"]["asignada"] = new Date()+1;
	guardarSesiones(sessions); 
	idUsuarioAsignadoAnterior = idUsuarioAsignadoActual;
	idUsuarioAsignadoActual = min;


	if(sessions[idUsuarioAsignadoAnterior] != undefined){
		console.log("Asignado anterior: "+sessions[idUsuarioAsignadoAnterior]["nombre"]);
	}
	console.log("Asignado actualmente: "+sessions[idUsuarioAsignadoActual]["nombre"]);
}


function anunciarAsignacionTarea(estado){
	


	if(idUsuarioAsignadoAnterior != undefined){
		let mensaje = sessions[idUsuarioAsignadoAnterior]["nombre"]+" a terminado su tarea";
		sendMessage(idUsuarioAsignadoActual, mensaje);
	}

		console.log("Le toca limpiar a "+sessions[idUsuarioAsignadoActual]["nombre"]);

	let recordatorio = sessions[idUsuarioAsignadoActual]["nombre"]+", te toca realizar las tares diarias antes del dia "+(new Date().getDate()+1)+" a las 23:59";
	let markup = setButtons('aviso');
	sendMessage(idUsuarioAsignadoActual, recordatorio, markup);

	esperandoConfirmacionTarea = true;
	


}









////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Triggers */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function trigger(conversation, texto, minutos, hora){
	var myVar = setInterval(myTimer, (minutos*1000)*60 );

	function myTimer() {
		//Aplicar condicion para enviar respuesta si fecha == X
		if(hora != undefined){
			if(hora == new Date.getHours()){
				sendMessage(conversation, texto);
			}
		}else{
	 		sendMessage(conversation, texto);
		}
	}

	return myVar;
}

function cancelTrigger(trigger){
	tareaCompletada();
	clearInterval(trigger);
	
}


function tareaCompletada(){
	sessions[idUsuarioAsignadoActual]["tareaDiaria"]["asignada"]=0;
	sessions[idUsuarioAsignadoActual]["tareaDiaria"]["ultimoDiaCompletada"] = new Date();
	guardarSesiones(sessions);
	
}


function tareaIncompleta(){
	sessions[idUsuarioAsignadoAnterior]["tareaDiaria"]["asignada"]= new Date()+1;
	sessions[idUsuarioAsignadoAnterior]["tareaDiaria"]["ultimoDiaCompletada"] = new Date(2000,1);
	guardarSesiones(sessions);	
}







/*
    let fecha = new Date();

    let d = fecha.getDate();
    let m = fecha.getMonth() + 1;
    let y = fecha.getFullYear();

    let h = fecha.getHours();
    let min = fecha.getMinutes();
    let s = fecha.getSeconds();

*/


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Ayuda */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Muestra los comandos disponibles y su funcion
function textoAyuda(conversation) {
    sendMessage(conversation, "Aquí tiene que ir el texto de ayuda que te dice qué comandos existen y cuál es su función");
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Gestion de archivos */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// Devuelve el JSON que se encuentra en PATH
function cargarJSON(PATH) {
    let archivoJSON = undefined;

    if (fs.existsSync(PATH)) {
        archivoJSON = JSON.parse(fs.readFileSync(PATH));
    }

    return archivoJSON;
}

// Escribe en el JSON situado en PATH el texto 'text' en la clave 'clave'
function escribeJSON(PATH, clave, text) {
    let archivoJSON = cargarJSON(PATH);

    if (archivoJSON[clave] !== undefined) {
        archivoJSON[clave].push(text);
        sobreescribeJSON(PATH, archivoJSON);
    }
}

// Escribe el JSON recibido en 'text' en la ruta PATH, y sustituye el archivo si existe
function sobreescribeJSON(PATH, text) {
    fs.writeFileSync(PATH, JSON.stringify(text));
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Envio de mensajes, archivos y gestion de botones */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Envia el mensaje pasado por parametro con la estructura markup (opcional)
function sendMessage(conversation, botMessage, markup) {
    if (botMessage !== undefined) {
        telegramBot.sendChatAction(conversation, 'typing');

        if (markup === undefined) {
            markup = {
                reply_markup: {
                    remove_keyboard: true
                }
            };
        }

        telegramBot.sendMessage(conversation, botMessage, markup);
    
    } else {
        console.log("Error, el mensaje 'botMessage' recibido en 'function sendMessage(conversation, botMessage, markup)' esta vacio");
    }
}

// Envia el archivo que se encuentra en la ruta pasada por parametro
function sendDocument(conversation, PATH) {
    if (PATH !== undefined) {
        telegramBot.sendDocument(conversation, PATH);
    } else {
        console.log("Error, la ruta recibida en 'function sendDocument(conversation, PATH) esta vacia");
    }
}

// Gestion de botones en funcion de la accion requerida
function setButtons(action) {
    let markup = {};

    markup["reply_markup"] = {};
    markup["reply_markup"]['resize_keyboard'] = true;
    markup["reply_markup"]['keyboard'] = [];

    let textos = undefined;



    if (action === "aviso")
        textos = ["Acepto", "No estoy en casa" , "Reportar Usuario"];
    else if (action === "sexo")
        textos = ["Hombre", "Mujer"];
    else
        markup = {reply_markup: {remove_keyboard: true}};

    if (textos !== undefined) {
        textos.forEach(function (text, i) {
            markup['reply_markup']['keyboard'][i] = [];
            markup["reply_markup"]['keyboard'][i][0] = {};
            markup["reply_markup"]['keyboard'][i][0]['text'] = text;
        });
    }

    return markup;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Sesiones */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function cargarSesiones(){
    let data;
    if(fs.existsSync(SESIONES_PATH)){
        data = JSON.parse(fs.readFileSync(SESIONES_PATH));
    }else{
        fs.writeFileSync(SESIONES_PATH, JSON.stringify(data));
    }
    return data;
}

function guardarSesiones(data){
    fs.writeFileSync(SESIONES_PATH, JSON.stringify(data));
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Herramientas */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Retorna un entero aleatorio entre min (incluido) y max (excluido)
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

// Elimina cualquier tipo de acento
function eliminaTilde(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Utiliza eliminaTilde() y pasa la cadena a mayusculas
function normalizaCadena(str) {
    return eliminaTilde(str).toUpperCase();
}