import React, { useReducer, useEffect, useState } from 'react';
import {
	View,
	StyleSheet,
	Text,
	Dimensions,
	Platform,
	TouchableOpacity,
	AppState,
	Switch,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Sound from 'react-native-sound';
import KeepAwake from 'react-native-keep-awake';

// Enable playback in silence mode
Sound.setCategory('Playback');

export default (App = () => {
	const [appState, setAppState] = useState('active');

	const [contBack, setContBack] = useState(true);

	const [thirtyMin, setThirtyMin] = useState(false);

	let interval = thirtyMin ? 1800 : 30;

	const reducer = (state, action) => {
		// add one more sec.
		let hour = state.hour,
			min = state.min,
			sec = state.sec;

		let seconds = state.seconds,
			turnRest = state.turnRest,
			count = state.count;

		// but if state has become 'active', then assign new.
		if (appState === 'active') {
			let date = new Date();
			if (contBack && !state.paused) {
				let newHour = date.getHours();
				let newMin = date.getMinutes();
				let newSec = date.getSeconds();

				// get diff from latest hour, min, sec.
				let sec1 = (newHour * 60 + newMin) * 60 + newSec;
				let sec0 = (hour * 60 + min) * 60 + sec;
				let diffSec = sec1 - sec0 + (sec1 > sec0 ? 0 : 24 * 60 * 60);

				console.log(`diffSec is ${diffSec}`);

				hour = newHour;
				min = newMin;
				sec = newSec;

				// then, apply to seconds and count as well as turnRest.
				var quotient = Math.floor(diffSec / interval);
				let remainder = diffSec % interval;

				// apply to seconds.
				seconds = seconds + remainder;
				if (seconds > interval) {
					seconds -= interval;
					quotient++;
				}

				// apply to count.
				count = count + Math.floor(((turnRest ? 1 : 0) + quotient) / 2);

				// apply to turnRest.
				turnRest = quotient % 2 == 0 ? turnRest : !turnRest;
			} else {
				hour = date.getHours();
				min = date.getMinutes();
				sec = date.getSeconds();
			}
		} else {
			// if just clock tick, advance sec.
			sec++;
			// adjust sec, min, and hour.
			sec === 60
				? ((sec = 0),
					min++ ,
					min === 60
						? ((min = 0), hour++ , hour == 24 ? (hour = 0) : null)
						: null)
				: null;
		}

		if (state.paused == false) {
			if (appState !== 'active') {
				seconds++;
			}

			if (seconds === interval) {
				seconds = 0;
				turnRest = !turnRest;

				// Load the sound file 'whoosh.mp3' from the app bundle
				// See notes below about preloading sounds within initialization code below.
				let whoosh = new Sound(
					'beyond_doubt_2.mp3',
					Sound.MAIN_BUNDLE,
					error => {
						if (error) {
							console.log('failed to load the sound', error);
							return;
						} else {
							whoosh.play();
						}
						// loaded successfully
						console.log(
							'duration in seconds: ' +
							whoosh.getDuration() +
							' number of channels: ' +
							whoosh.getNumberOfChannels(),
						);
					},
				);

				// update battery level only when count up is called.
				DeviceInfo.getBatteryLevel().then(batteryLevel => {
					dispatch({ type: 'battery_level', payload: batteryLevel * 100 });
				});

				// if rest finishes, count up.
				if (turnRest == false) {
					count++;
				}
			}
		}

		if (appState !== 'has_been_active') {
			setAppState('has_been_active');
		}

		switch (action.type) {
			case 'clock_tick':
				return {
					...state,
					seconds,
					turnRest,
					count,
					hour,
					min,
					sec,
				};
			case 'pause_pressed':
				return { ...state, paused: !state.paused };
			case 'reset_pressed':
				return { ...state, seconds: 0, count: 1, paused: false };
			case 'battery_level':
				return { ...state, batteryLevel: action.payload };
			default:
				console.log('default inside reducer');
				return { ...state, hour, min, sec };
		}
	};

	const date = new Date();
	const [state, dispatch] = useReducer(reducer, {
		seconds: 0,
		count: 1,
		turnRest: false,
		paused: false,
		hour: date.getHours(),
		min: date.getMinutes(),
		sec: date.getSeconds(),
		batteryLevel: 100,
	});

	const screenWidth = Dimensions.get('window').width;
	const screenHeight = Dimensions.get('window').height;
	const fontSize = screenWidth < screenHeight ? screenWidth / 6 : screenHeight / 6;
	const buttonFontSize = fontSize / 3;

	console.log(
		`contBack: ${contBack} seconds: ${state.seconds} count: ${
		state.count
		} turnRest: ${state.turnRest} paused: ${
		state.paused
		} appState: ${appState} 30min: ${thirtyMin} int: ${interval}`
	);

	useEffect(() => {
		const handleAppState = nextAppState => setAppState(nextAppState);
		AppState.addEventListener('change', handleAppState);
		return () => {
			AppState.removeEventListener('change', handleAppState);
		};
	}, []);

	// effects runs right after every re-render. (including the first rendering)
	// if array is attached, skip effects if elements' values are unchanged.
	// so if blank, always skip - actually, runs only after first render
	// (and after unmount if return is included) - states change from undefined.
	useEffect(() => {
		// it will execute setTimeout() and also stores the timer into the variable.
		let timer = setInterval(() => {
			// if seconds is now n-1, set to 0, instead of n.
			dispatch({ type: 'clock_tick' });
		}, 1000);
		// function returned will be executed before running effects again.
		return () => {
			clearInterval(timer);
		};
	}, []);

  // make the app prevent the phone from sleeping.
  useEffect(() => {
    KeepAwake.activate();
  }, []);

	const fontFamily = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

	// change color depending on turnRest.

	const switchDidChange = () => {
		setContBack(!contBack);
	};

	const switch30DidChange = () => {
		setThirtyMin(!thirtyMin);
		dispatch({ type: 'reset_pressed' });
	};

	return (
		<View style={styles.container}>
			{/* time */}
			<Text
				style={[styles.textWhite, { fontFamily, fontSize, color: '#C6D6F7' }]}>
				{(state.hour < 10 ? '0' : null) + state.hour}:
        {(state.min < 10 ? '0' : null) + state.min}:
        {(state.sec < 10 ? '0' : null) + state.sec}
			</Text>

			{/* seconds and count */}
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* <Text style={{ color: 'white', fontSize: buttonFontSize, marginLeft: 20 }}>
        Set :
				</Text> */}

				<Text
					style={[
						state.turnRest ? styles.textGreen : styles.textWhite,
						{
							fontFamily,
							fontSize,
						},
					]}>
					{state.count}-
				</Text>
				<Text style={[styles.textWhite, { fontFamily, fontSize }]}>
					{state.seconds}
				</Text>
			</View>

			{/* play and reset button */}
			<View style={{ flexDirection: 'row' }}>
				<TouchableOpacity
					style={styles.button}
					onPress={() => {
						dispatch({ type: 'pause_pressed' });
					}}
					color="white"
					title="Pause">
					<Text style={{ color: 'white', fontSize: buttonFontSize }}>
						{state.paused ? 'Play' : 'Pause'}
					</Text>
				</TouchableOpacity>

				<Text
					style={{
						paddingVertical: 5,
						color: 'white',
						fontSize: buttonFontSize,
					}}>
					{state.batteryLevel.toFixed(0)}%
        </Text>
				<TouchableOpacity
					style={styles.button}
					onPress={() => {
						dispatch({ type: 'reset_pressed' });
					}}
					color="white"
					title="Pause">
					<Text style={{ color: 'white', fontSize: buttonFontSize }}>Reset</Text>
				</TouchableOpacity>
			</View>

			{/* toggle switch */}
			<View
				style={{
					borderRadius: 20,
					flexDirection: 'row',
					marginVertical: 20,
					paddingHorizontal: 20,
					backgroundColor: 'lightgrey',
				}}>
				<Text
					style={{
						paddingVertical: 5,
						color: 'black',
						fontSize: buttonFontSize,
						paddingRight: 10,
					}}>
					Continue on Bkgd.
        		</Text>
				<Switch onValueChange={switchDidChange} value={contBack} />
			</View>

			{/* toggle switch */}
			<View
				style={{
					borderRadius: 20,
					flexDirection: 'row',
					marginVertical: 10,
					paddingHorizontal: 20,
					backgroundColor: 'lightgrey',
				}}>
				<Text
					style={{
						paddingVertical: 5,
						color: 'black',
						fontSize: buttonFontSize,
						paddingRight: 10,
					}}>
					30 Min Mode
        		</Text>
				<Switch onValueChange={switch30DidChange} value={thirtyMin} />
			</View>
		</View>
	);
});

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
		alignItems: 'center',
		justifyContent: 'center',
	},
	textWhite: {
		fontWeight: 'bold',
		color: 'white',
	},
	textGreen: {
		fontWeight: 'bold',
		color: 'green',
	},
	button: {
		paddingHorizontal: 30,
		paddingVertical: 5,
	},
});
