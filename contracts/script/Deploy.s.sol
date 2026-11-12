// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ProvenanceRegistry.sol";

contract DeployScript is Script {
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        ProvenanceRegistry registry = new ProvenanceRegistry(deployer);
        vm.stopBroadcast();

        console.log("ProvenanceRegistry deployed at:", address(registry));
        return address(registry);
    }
}
