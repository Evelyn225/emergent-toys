# Emergency shifts

Enter a hospital or fire station and use its **DISPATCH** terminal to sign on.
Dispatch supplies a legal ambulance or fire engine; taking an unattended service
vehicle outside a shift still counts as theft. One driving job can be active at
a time. End the shift at a dispatch terminal or through the pause menu.

- **H** toggles lights and siren. Traffic yields using the existing emergency
  vehicle rules. The compass and maps show the active call.
- **Paramedic:** stop within 18 m, get out with E, then E beside the patient.
  Stay close for the three-second treatment and loading. E beside the ambulance
  gets back in. Stop at a hospital handover marker to deliver the patient.
- **Firefighter:** stop and get out, E beside the engine to take the hose.
  Aim and hold Q or the primary mouse button to spray. The hose reaches 26 m
  and stays connected within 30 m of the engine. J beside the engine drives it
  again. A controller's use trigger and the touch spray button also work.
- Calls pay a base amount plus a response bonus. Fire patches must all be out;
  a lost vehicle does not count as a successful extinguishment. Handover and
  payout happen once per call.

Random NPC fire dispatch now creates an actual car or building fire. Crews wait
at the scene, spray visible water until it is out, then return to base. Fire heat
hurts nearby players and frightens pedestrians. Bounded street incidents do not
permanently remove city buildings. Player-owned burning cars retain their
explosion countdown; water buys time and can save the damaged vehicle.

In multiplayer, incidents, patient stages, assignments, fire heat, NPC engines,
water streams and completion are shared. The creator owns each incident and
validates remote actions. Late joins receive current snapshots; an elected
remaining peer takes over when the creator leaves, releasing disconnected crews'
patients for another responder. There is one assigned paid crew per call; other
firefighters can help with the hose. Protocol 11 requires everyone to refresh.

Regression coverage lives in `test/browser/city-emergency-shifts.browser.test.cjs`,
`test/browser/city-emergency-net.browser.test.cjs` and
`test/city-emergency-incidents.test.cjs`. Rebuild with `node tools/build-city.cjs`.
